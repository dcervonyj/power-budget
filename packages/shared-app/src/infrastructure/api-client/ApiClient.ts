import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient.js';
import type { SecureTokenStore } from '../tokens/SecureTokenStore.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export class ApiClient implements HttpClient {
  private readonly _axios: AxiosInstance;

  constructor(
    baseURL: string,
    private readonly tokenStore: SecureTokenStore,
    private readonly onUnauthenticated?: () => void,
  ) {
    this._axios = axios.create({ baseURL });

    this._axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = this.tokenStore.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    let isRefreshing = false;
    let failedQueue: Array<{
      resolve: (token: string) => void;
      reject: (reason?: unknown) => void;
    }> = [];

    const processQueue = (error: unknown, token: string | null = null): void => {
      for (const { resolve, reject } of failedQueue) {
        if (error) {
          reject(error);
        } else {
          resolve(token!);
        }
      }
      failedQueue = [];
    };

    this._axios.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        const axiosError = error as AxiosError;
        const originalRequest = axiosError.config as RetryableConfig | undefined;

        if (axiosError.response?.status !== 401 || !originalRequest || originalRequest._retry) {
          if (axiosError.response?.status === 401) {
            await this.tokenStore.clearTokens();
            this.onUnauthenticated?.();
          }
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this._axios(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = this.tokenStore.getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await this._axios.post<RefreshResponse>('/auth/refresh', {
            refreshToken,
          });

          await this.tokenStore.setTokens(data.accessToken, data.refreshToken);
          processQueue(null, data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return this._axios(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          await this.tokenStore.clearTokens();
          this.onUnauthenticated?.();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      },
    );
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

  async delete<T = unknown>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', ...(headers ? { headers } : {}) });
  }
}
