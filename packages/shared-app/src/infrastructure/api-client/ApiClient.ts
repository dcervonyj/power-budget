import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient.js';
import type { SecureTokenStore } from '../tokens/SecureTokenStore.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (reason: unknown) => void;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATH_PREFIX = '/auth/';
const REFRESH_PATH = '/auth/refresh';
const ABSOLUTE_URL_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+/i;

export class ApiClient implements HttpClient {
  private readonly _axios: AxiosInstance;
  private refreshInFlight = false;
  private refreshQueue: QueuedRequest[] = [];

  constructor(
    baseURL: string,
    private readonly tokenStore: SecureTokenStore,
    private readonly onUnauthenticated?: () => void,
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

  private attachAccessToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const token = this.tokenStore.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      const refreshToken = this.tokenStore.getRefreshToken();
      if (!refreshToken) {
        throw originalError;
      }
      const { data } = await this._axios.post<RefreshResponse>(REFRESH_PATH, { refreshToken });
      await this.tokenStore.setTokens(data.accessToken, data.refreshToken);
      this.settleQueue(null, data.accessToken);

      return data.accessToken;
    } catch (refreshError) {
      this.settleQueue(refreshError, null);
      await this.endSession();
      throw refreshError;
    } finally {
      this.refreshInFlight = false;
    }
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
    originalRequest.headers.Authorization = `Bearer ${token}`;

    return this._axios(originalRequest);
  }

  private async endSession(): Promise<void> {
    await this.tokenStore.clearTokens();
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
