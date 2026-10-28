import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient.js';
import type { SecureTokenStore } from '../tokens/SecureTokenStore.js';
import { readApiError } from './ApiError.js';
import {
  BAD_STATUS_CODE,
  HttpError,
  NETWORK_CODE,
  TIMEOUT_CODE,
  type HttpErrorResponse,
} from './HttpError.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (reason: unknown) => void;
}

interface SessionTokens {
  accessToken: string | null;
  refreshToken: string;
}

/** `epoch` is the session id the request started under; it survives the retry. */
interface PendingRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  retried: boolean;
  timeoutMs: number;
  epoch: number | undefined;
}

type RequestBody = NonNullable<RequestInit['body']>;
type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

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
const UNAUTHORIZED = 401;
const REVOKE_TIMEOUT_MS = 5000;
const SESSION_REJECTED_STATUSES: readonly number[] = [400, 401];
const SUCCESS_STATUS_LIMIT = 300;
const ABSOLUTE_OR_PROTOCOL_RELATIVE = /^([a-z][a-z0-9+.-]*:)?\/\//i;
const ABSOLUTE_URL_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+/i;

export class ApiClient implements HttpClient {
  private signingOut = false;
  private refreshInFlight = false;
  private refreshQueue: QueuedRequest[] = [];
  /**
   * Session id: bumped whenever a session ends (sign-out or expiry). Work started under an earlier
   * id (a refresh, a queued save, a locale update) must not touch the next session.
   */
  private sessionEpoch = 0;
  /** Token writes and session clearing run strictly one after another through this chain. */
  private storageChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly baseURL: string,
    private readonly tokenStore: SecureTokenStore,
    private readonly onUnauthenticated?: () => void,
    private readonly raceTiming: RefreshRaceTiming = DEFAULT_REFRESH_RACE_TIMING,
    private readonly fetchFn: FetchFn = defaultFetch,
  ) {}

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    const response = await this.send({
      url: req.url,
      method: req.method,
      headers: { ...req.headers },
      body: req.body,
      retried: false,
      timeoutMs: req.timeoutMs ?? 0,
      epoch: undefined,
    });

    return { status: response.status, data: castBody<T>(response.data), headers: response.headers };
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

  get sessionId(): number {
    return this.sessionEpoch;
  }

  /**
   * Ends the session on purpose (sign-out): refreshes already in flight are invalidated first, so
   * a late rotated pair can never be stored again after the tokens are cleared.
   */
  async invalidateSession(): Promise<void> {
    await this.endSession();
  }

  /**
   * Signs out. The session is first marked as ending (no new refresh starts, 401 retries fail),
   * then a refresh already in flight is awaited (bounded) so the token that is current at that
   * moment is the one revoked. The local tokens are cleared right away; the server-side revocation
   * then works only on the pair captured here, never reads client state again, and so cannot touch
   * a later login. Best effort: revocation failures and timeouts never block the sign-out.
   */
  async signOut(): Promise<void> {
    const captured = await this.endSessionCapturingTokens();
    if (captured) {
      await Promise.race([this.revokeCaptured(captured), delay(REVOKE_TIMEOUT_MS)]);
    }
  }

  private async endSessionCapturingTokens(): Promise<SessionTokens | null> {
    this.signingOut = true;
    try {
      await this.settleRefreshInFlight();
      const captured = this.captureTokens();
      await this.endSession();

      return captured;
    } finally {
      this.signingOut = false;
    }
  }

  private captureTokens(): SessionTokens | null {
    const accessToken = this.tokenStore.getAccessToken();
    const refreshToken = this.tokenStore.getRefreshToken();

    return refreshToken ? { accessToken, refreshToken } : null;
  }

  private async settleRefreshInFlight(): Promise<void> {
    if (!this.refreshInFlight) {
      return;
    }
    try {
      await Promise.race([this.waitForRefresh(), delay(REVOKE_TIMEOUT_MS)]);
    } catch {
      // A failed refresh leaves the stored pair as it was; revoke whatever is current.
    }
  }

  /** /auth/logout needs a valid access token: an expired one is refreshed once from the captured pair. */
  private async revokeCaptured(captured: SessionTokens): Promise<void> {
    try {
      await this.postLogout(captured.accessToken, captured.refreshToken);
    } catch (error) {
      if (readApiError(error).status !== UNAUTHORIZED) {
        return;
      }
      await this.refreshThenLogout(captured.refreshToken);
    }
  }

  private async refreshThenLogout(refreshToken: string): Promise<void> {
    try {
      const { data } = await this.sendBare<RefreshResponse>(REFRESH_PATH, { refreshToken }, {});
      await this.postLogout(data.accessToken, data.refreshToken);
    } catch {
      // Revocation is best effort; the local session is already gone.
    }
  }

  private async postLogout(accessToken: string | null, refreshToken: string): Promise<void> {
    await this.sendBare(
      '/auth/logout',
      { refreshToken },
      accessToken ? { Authorization: bearer(accessToken) } : {},
    );
  }

  /** No token header, no refresh and no client state: the revocation of a captured pair only. */
  private sendBare<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.transport<T>({
      url,
      method: 'POST',
      headers,
      body,
      retried: false,
      timeoutMs: REVOKE_TIMEOUT_MS,
      epoch: undefined,
    });
  }

  /** Attaches the current access token, sends, and recovers from a 401 (refresh and retry once). */
  private async send(req: PendingRequest): Promise<HttpResponse> {
    if (req.epoch === undefined) {
      req.epoch = this.sessionEpoch;
    }
    const token = this.tokenStore.getAccessToken();
    if (token) {
      req.headers['Authorization'] = bearer(token);
    }
    try {
      return await this.transport(req);
    } catch (error) {
      return this.handleResponseError(error, req);
    }
  }

  /** One fetch call; `timeoutMs` 0 means no timeout. Non-2xx answers and failures become HttpError. */
  private async transport<T>(req: PendingRequest): Promise<HttpResponse<T>> {
    const timeoutMs = req.timeoutMs;
    const controller = new AbortController();
    const timer =
      timeoutMs > 0 ? setTimeout(controller.abort.bind(controller), timeoutMs) : undefined;
    try {
      const response = await this.fetchFn(this.resolveUrl(req.url), {
        method: req.method,
        headers: requestHeaders(req),
        ...requestBody(req.body),
        signal: controller.signal,
      });
      const data = await readBody(response);
      if (response.status < 200 || response.status >= SUCCESS_STATUS_LIMIT) {
        throw httpStatusError(req, { status: response.status, data });
      }

      return {
        status: response.status,
        data: castBody<T>(data),
        headers: responseHeaders(response),
      };
    } catch (error) {
      throw toHttpError(error, req, controller.signal.aborted);
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveUrl(url: string): string {
    if (ABSOLUTE_OR_PROTOCOL_RELATIVE.test(url)) {
      return url;
    }

    return `${this.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }

  private async handleResponseError(
    error: unknown,
    originalRequest: PendingRequest,
  ): Promise<HttpResponse> {
    if (!(error instanceof HttpError) || error.response?.status !== UNAUTHORIZED) {
      throw error;
    }
    // A 401 from /auth/* is an answer (wrong password, invalid TOTP code, dead
    // refresh token), not an expired access token. Refreshing on it would queue
    // the refresh call behind itself and hang every request (audit H24).
    if (isAuthRequest(originalRequest.url)) {
      throw error;
    }
    // An answer to a request of an earlier session says nothing about the current one: it must not
    // refresh, retry or end the session of a later login.
    const epoch = originalRequest.epoch ?? this.sessionEpoch;
    if (epoch !== this.sessionEpoch) {
      throw error;
    }
    // A sign-out in progress owns the session: no new refresh may rotate the token it revokes.
    if (this.signingOut) {
      throw error;
    }
    if (originalRequest.retried) {
      await this.endSessionOf(epoch);
      throw error;
    }
    // Another tab (they share the token store) may have refreshed while this
    // request was in flight: its token is valid, and our refresh token is spent.
    const storedToken = this.tokenStore.getAccessToken();
    if (storedToken && originalRequest.headers['Authorization'] !== bearer(storedToken)) {
      return this.retry(originalRequest, storedToken);
    }
    if (this.refreshInFlight) {
      const token = await this.waitForRefresh();

      return this.retry(originalRequest, token);
    }

    return this.refreshAndRetry(originalRequest, error);
  }

  private async refreshAndRetry(
    originalRequest: PendingRequest,
    originalError: HttpError,
  ): Promise<HttpResponse> {
    const accessToken = await this.refreshTokens(originalError);

    return this.retry(originalRequest, accessToken);
  }

  private async refreshTokens(originalError: HttpError): Promise<string> {
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

  private async obtainAccessToken(originalError: HttpError): Promise<string> {
    const epoch = this.sessionEpoch;
    const refreshToken = this.tokenStore.getRefreshToken();
    if (!refreshToken) {
      await this.endSessionOf(epoch);
      throw originalError;
    }
    const outcome = await this.requestRefresh(refreshToken, epoch);
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
  private storeTokens(epoch: number, tokens: RefreshResponse, originalError: Error): Promise<void> {
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

  private async requestRefresh(refreshToken: string, epoch: number): Promise<RefreshOutcome> {
    try {
      const { data } = await this.post<RefreshResponse>(REFRESH_PATH, { refreshToken });

      return { kind: 'rotated', tokens: data };
    } catch (refreshError) {
      const accessToken = await this.recoverFromRefreshFailure(refreshError, refreshToken, epoch);

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
    epoch: number,
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
    await this.endSessionOf(epoch);
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

  private retry(originalRequest: PendingRequest, token: string): Promise<HttpResponse> {
    originalRequest.retried = true;
    originalRequest.headers['Authorization'] = bearer(token);

    return this.send(originalRequest);
  }

  /** Ends the session only if it is still the one the caller's request or refresh started under. */
  private async endSessionOf(epoch: number): Promise<void> {
    if (epoch === this.sessionEpoch) {
      await this.endSession();
    }
  }

  private async endSession(): Promise<void> {
    this.sessionEpoch += 1;
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

function defaultFetch(input: string, init: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

function requestHeaders(req: PendingRequest): Headers {
  const headers = new Headers(req.headers);
  if (isJsonBody(req.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function isJsonBody(body: unknown): boolean {
  return body !== undefined && body !== null && typeof body !== 'string' && !isRawBody(body);
}

function isRawBody(body: unknown): body is RequestBody {
  return (
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  );
}

function requestBody(body: unknown): { body?: RequestBody } {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body === 'string' || isRawBody(body)) {
    return { body };
  }

  return { body: JSON.stringify(body) };
}

/** JSON when the body parses as JSON (what axios did by default), else the text, '' when empty. */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text === '' ? '' : JSON.parse(text);
  } catch {
    return text;
  }
}

/** The body is whatever the server sent; the caller names the shape it expects, as with axios. */
function castBody<T>(data: unknown): T {
  return data as T;
}

function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach(function collect(value, key) {
    headers[key] = value;
  });

  return headers;
}

function httpStatusError(req: PendingRequest, response: HttpErrorResponse): HttpError {
  return new HttpError(
    `HTTP ${response.status}`,
    BAD_STATUS_CODE,
    { url: req.url, method: req.method },
    response,
  );
}

function toHttpError(error: unknown, req: PendingRequest, aborted: boolean): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  const request = { url: req.url, method: req.method };
  if (aborted) {
    return new HttpError('Request timed out', TIMEOUT_CODE, request);
  }

  return new HttpError('Network Error', NETWORK_CODE, request);
}
