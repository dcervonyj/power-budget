import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient.js';
import type { SecureTokenStore } from '../tokens/SecureTokenStore.js';
import { readApiError } from './ApiError.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (reason: unknown) => void;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** The refresh answered 201 (the pair to store), or another tab's pair was adopted. */
type RefreshOutcome =
  { kind: 'rotated'; tokens: RefreshResponse } | { kind: 'adopted'; accessToken: string };

/**
 * How long a tab whose refresh was rejected waits for another tab to store the
 * rotated pair before it ends the session. The winning refresh still writes
 * Redis, reads the household and signs a JWT after the loser was rejected, so
 * its pair usually lands a moment later.
 */
export interface RefreshRaceTiming {
  readonly waitMs: number;
  readonly pollMs: number;
}

const DEFAULT_REFRESH_RACE_TIMING: RefreshRaceTiming = { waitMs: 3000, pollMs: 100 };

const AUTH_PATH_PREFIX = '/auth/';
const REFRESH_PATH = '/auth/refresh';
const SESSION_REJECTED_STATUSES: readonly number[] = [400, 401];
const ABSOLUTE_URL_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+/i;

export class ApiClient implements HttpClient {
  private readonly _axios: AxiosInstance;
  private refreshInFlight = false;
  private refreshQueue: QueuedRequest[] = [];
  /** Bumped on every deliberate sign-out; a refresh that started earlier must not store tokens. */
  private sessionEpoch = 0;
  /** Token writes and session clearing run strictly one after another through this chain. */
  private storageChain: Promise<unknown> = Promise.resolve();

  constructor(
    baseURL: string,
    private readonly tokenStore: SecureTokenStore,
    private readonly onUnauthenticated?: () => void,
    private readonly raceTiming: RefreshRaceTiming = DEFAULT_REFRESH_RACE_TIMING,
  ) {
    this._axios = axios.create({ baseURL });
    this._axios.interceptors.request.use(this.attachAccessToken.bind(this));
    this._axios.interceptors.response.use(undefined, this.handleResponseError.bind(this));
  }

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    const response = await this._axios.request<T>({
      url: req.url,
      method: req.method,
      ...(req.headers ? { headers: req.headers } : {}),
      data: req.body,
    });

    return {
      status: response.status,
      data: response.data,
      headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])),
    };
  }

  async get<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'GET', ...(headers ? { headers } : {}) });
  }

  async post<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'POST', body, ...(headers ? { headers } : {}) });
  }

  async put<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PUT', body, ...(headers ? { headers } : {}) });
  }

  async patch<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PATCH', body, ...(headers ? { headers } : {}) });
  }

  async delete<T = unknown>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', ...(headers ? { headers } : {}) });
  }

  /**
   * Ends the session on purpose (sign-out): refreshes already in flight are invalidated first, so
   * a late rotated pair can never be stored again after the tokens are cleared.
   */
  async invalidateSession(): Promise<void> {
    this.sessionEpoch += 1;
    await this.endSession();
  }

  private attachAccessToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const token = this.tokenStore.getAccessToken();
    if (token) {
      config.headers.Authorization = bearer(token);
    }

    return config;
  }

  private async handleResponseError(error: unknown): Promise<AxiosResponse> {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      throw error;
    }
    const originalRequest: RetryableConfig = error.config;
    // A 401 from /auth/* is an answer (wrong password, invalid TOTP code, dead
    // refresh token), not an expired access token. Refreshing on it would queue
    // the refresh call behind itself and hang every request (audit H24).
    if (isAuthRequest(originalRequest.url)) {
      throw error;
    }
    if (originalRequest._retry) {
      await this.endSession();
      throw error;
    }
    // Another tab (they share the token store) may have refreshed while this
    // request was in flight: its token is valid, and our refresh token is spent.
    const storedToken = this.tokenStore.getAccessToken();
    if (storedToken && originalRequest.headers.Authorization !== bearer(storedToken)) {
      return this.retry(originalRequest, storedToken);
    }
    if (this.refreshInFlight) {
      const token = await this.waitForRefresh();

      return this.retry(originalRequest, token);
    }

    return this.refreshAndRetry(originalRequest, error);
  }

  private async refreshAndRetry(
    originalRequest: RetryableConfig,
    originalError: AxiosError,
  ): Promise<AxiosResponse> {
    const accessToken = await this.refreshTokens(originalError);

    return this.retry(originalRequest, accessToken);
  }

  private async refreshTokens(originalError: AxiosError): Promise<string> {
    this.refreshInFlight = true;
    try {
      const accessToken = await this.obtainAccessToken(originalError);
      this.settleQueue(null, accessToken);

      return accessToken;
    } catch (refreshError) {
      this.settleQueue(refreshError, null);
      throw refreshError;
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async obtainAccessToken(originalError: AxiosError): Promise<string> {
    const refreshToken = this.tokenStore.getRefreshToken();
    if (!refreshToken) {
      await this.endSession();
      throw originalError;
    }
    const epoch = this.sessionEpoch;
    const outcome = await this.requestRefresh(refreshToken);
    if (epoch !== this.sessionEpoch) {
      throw originalError;
    }
    if (outcome.kind === 'adopted') {
      return outcome.accessToken;
    }
    // Outside the refresh-error classification: a storage failure is not an HTTP answer.
    await this.storeTokens(epoch, outcome.tokens, originalError);

    return outcome.tokens.accessToken;
  }

  /** Writes the pair unless the session was invalidated; a later clear waits for this write. */
  private storeTokens(
    epoch: number,
    tokens: RefreshResponse,
    originalError: AxiosError,
  ): Promise<void> {
    return this.serialize(async () => {
      if (epoch !== this.sessionEpoch) {
        throw originalError;
      }
      await this.tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
    });
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.storageChain.then(task, task);
    this.storageChain = run.then(ignore, ignore);

    return run;
  }

  private async requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
    try {
      const { data } = await this._axios.post<RefreshResponse>(REFRESH_PATH, { refreshToken });

      return { kind: 'rotated', tokens: data };
    } catch (refreshError) {
      const accessToken = await this.recoverFromRefreshFailure(refreshError, refreshToken);

      return { kind: 'adopted', accessToken };
    }
  }

  /**
   * Only a 400/401 from /auth/refresh means the refresh token is dead. A 5xx or
   * a network error (cold start, deploy, offline) says nothing about it, so the
   * session stays and the caller gets the error to retry later (audit FE-BUGS-03).
   */
  private async recoverFromRefreshFailure(
    refreshError: unknown,
    usedRefreshToken: string,
  ): Promise<string> {
    if (!SESSION_REJECTED_STATUSES.includes(readApiError(refreshError).status)) {
      throw refreshError;
    }
    // Refresh tokens are single use: when two tabs refresh with the same one, one
    // of them is rejected, usually before the other has stored the rotated pair.
    const polls = Math.ceil(this.raceTiming.waitMs / this.raceTiming.pollMs);
    const rotated = await this.waitForRotation(usedRefreshToken, polls);
    const storedAccessToken = this.tokenStore.getAccessToken();
    if (rotated && storedAccessToken) {
      return storedAccessToken;
    }
    await this.endSession();
    throw refreshError;
  }

  /** True once the stored refresh token is no longer the one this tab spent. */
  private async waitForRotation(usedRefreshToken: string, pollsLeft: number): Promise<boolean> {
    if (this.tokenStore.getRefreshToken() !== usedRefreshToken) {
      return true;
    }
    if (pollsLeft <= 0) {
      return false;
    }
    await delay(this.raceTiming.pollMs);

    return this.waitForRotation(usedRefreshToken, pollsLeft - 1);
  }

  private waitForRefresh(): Promise<string> {
    return new Promise<string>(this.enqueue.bind(this));
  }

  private enqueue(resolve: (token: string) => void, reject: (reason: unknown) => void): void {
    this.refreshQueue.push({ resolve, reject });
  }

  private settleQueue(error: unknown, token: string | null): void {
    const queue = this.refreshQueue;
    this.refreshQueue = [];
    for (const { resolve, reject } of queue) {
      if (token === null) {
        reject(error);
      } else {
        resolve(token);
      }
    }
  }

  private retry(originalRequest: RetryableConfig, token: string): Promise<AxiosResponse> {
    originalRequest._retry = true;
    originalRequest.headers.Authorization = bearer(token);

    return this._axios(originalRequest);
  }

  private async endSession(): Promise<void> {
    await this.serialize(() => this.tokenStore.clearTokens());
    this.onUnauthenticated?.();
  }
}

function isAuthRequest(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  const path = url.replace(ABSOLUTE_URL_ORIGIN, '');

  return path.startsWith(AUTH_PATH_PREFIX);
}

function ignore(): void {
  // The chain only orders tasks; each caller handles its own result.
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function bearer(token: string): string {
  return `Bearer ${token}`;
}
