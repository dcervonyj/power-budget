import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from '../ApiClient.js';
import { readApiError } from '../ApiError.js';
import type { SecureTokenStore } from '../../tokens/SecureTokenStore.js';

class InMemoryTokenStore implements SecureTokenStore {
  access: string | null = 'old-access';
  refresh: string | null = 'old-refresh';
  cleared = 0;

  getAccessToken(): string | null {
    return this.access;
  }

  getRefreshToken(): string | null {
    return this.refresh;
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.access = accessToken;
    this.refresh = refreshToken;
  }

  async clearTokens(): Promise<void> {
    this.access = null;
    this.refresh = null;
    this.cleared += 1;
  }
}

interface SeenRequest {
  url: string;
  authorization: string;
  body: unknown;
}

interface RouteResult {
  status: number;
  data: unknown;
}

type Route = (config: InternalAxiosRequestConfig) => RouteResult | Promise<RouteResult>;

/** Status 0 stands for "no response" (offline, DNS, connection reset). */
const NETWORK_ERROR = 0;

const HANG_GUARD_MS = 1000;

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  if (status === NETWORK_ERROR) {
    return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config, null));
  }
  const response = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 400) {
    return Promise.reject(
      new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, response),
    );
  }

  return Promise.resolve(response);
}

const REFRESH_LATENCY_MS = 20;

/**
 * The backend's refresh semantics: a refresh token is single use (Redis GETDEL),
 * each refresh rotates the pair, and only the latest access token is accepted.
 */
class RotatingRefreshServer {
  private validAccess = 'access-0';
  private readonly refreshTokens: Set<string>;
  private issued = 0;

  constructor(refreshToken: string) {
    this.refreshTokens = new Set([refreshToken]);
  }

  data(config: InternalAxiosRequestConfig): RouteResult {
    if (config.headers.Authorization === `Bearer ${this.validAccess}`) {
      return { status: 200, data: { ok: true } };
    }

    return { status: 401, data: { code: 'unauthorized' } };
  }

  async refresh(config: InternalAxiosRequestConfig): Promise<RouteResult> {
    await delay(REFRESH_LATENCY_MS);
    const body: unknown = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const refreshToken = Reflect.get(Object(body), 'refreshToken');
    if (typeof refreshToken !== 'string' || !this.refreshTokens.delete(refreshToken)) {
      return { status: 401, data: { code: 'invalid_credentials' } };
    }
    this.issued += 1;
    this.validAccess = `access-${this.issued}`;
    const rotated = `refresh-${this.issued}`;
    this.refreshTokens.add(rotated);

    return { status: 201, data: { accessToken: this.validAccess, refreshToken: rotated } };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function statusOf(result: PromiseSettledResult<{ status: number }>): number {
  if (result.status === 'fulfilled') {
    return result.value.status;
  }

  return readApiError(result.reason).status;
}

function withinGuard<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('request hung')), HANG_GUARD_MS);
    }),
  ]);
}

describe('ApiClient token refresh', () => {
  const originalAdapter = axios.defaults.adapter;
  let seen: SeenRequest[];
  let routes: Record<string, Route>;
  let store: InMemoryTokenStore;
  let unauthenticated: number;

  function createClient(): ApiClient {
    return new ApiClient('http://api.test', store, () => {
      unauthenticated += 1;
    });
  }

  beforeEach(() => {
    seen = [];
    routes = {};
    store = new InMemoryTokenStore();
    unauthenticated = 0;
    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? '';
      seen.push({
        url,
        authorization: String(config.headers.Authorization ?? ''),
        body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      });
      const route = routes[url];
      const { status, data } = route ? await route(config) : { status: 404, data: {} };

      return respond(config, status, data);
    };
    axios.defaults.adapter = adapter;
  });

  afterEach(() => {
    if (originalAdapter === undefined) {
      delete axios.defaults.adapter;
    } else {
      axios.defaults.adapter = originalAdapter;
    }
  });

  function protectedRoute(validToken: string): Route {
    return (config) =>
      config.headers.Authorization === `Bearer ${validToken}`
        ? { status: 200, data: { ok: true } }
        : { status: 401, data: { code: 'unauthorized' } };
  }

  it('refreshes once and retries the request with the new access token', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    const res = await withinGuard(createClient().get('/transactions'));

    expect(res.data).toEqual({ ok: true });
    expect(seen).toEqual([
      { url: '/transactions', authorization: 'Bearer old-access', body: undefined },
      {
        url: '/auth/refresh',
        authorization: 'Bearer old-access',
        body: { refreshToken: 'old-refresh' },
      },
      { url: '/transactions', authorization: 'Bearer new-access', body: undefined },
    ]);
    expect(store.access).toBe('new-access');
    expect(store.refresh).toBe('new-refresh');
    expect(unauthenticated).toBe(0);
  });

  it('does not hang when /auth/refresh itself answers 401', async () => {
    routes['/transactions'] = protectedRoute('never');
    routes['/auth/refresh'] = () => ({ status: 401, data: { code: 'invalid_refresh_token' } });

    const failure = await withinGuard(createClient().get('/transactions')).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AxiosError);
    expect((failure as AxiosError).response?.status).toBe(401);
    expect((failure as AxiosError).config?.url).toBe('/auth/refresh');
    expect(seen.map((r) => r.url)).toEqual(['/transactions', '/auth/refresh']);
    expect(store.cleared).toBe(1);
    expect(unauthenticated).toBe(1);
  });

  it('rejects every queued request when the refresh fails', async () => {
    routes['/a'] = protectedRoute('never');
    routes['/b'] = protectedRoute('never');
    routes['/auth/refresh'] = () => ({ status: 401, data: {} });
    const client = createClient();

    const results = await withinGuard(Promise.allSettled([client.get('/a'), client.get('/b')]));

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(seen.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
    expect(unauthenticated).toBe(1);
  });

  it('shares one refresh between concurrent 401s', async () => {
    routes['/a'] = protectedRoute('new-access');
    routes['/b'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });
    const client = createClient();

    const [a, b] = await withinGuard(Promise.all([client.get('/a'), client.get('/b')]));

    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
    expect(seen.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
  });

  it('passes a 401 from /auth/login through without refreshing or logging out', async () => {
    routes['/auth/login'] = () => ({ status: 401, data: { code: 'invalid_credentials' } });

    const failure = await withinGuard(
      createClient().post('/auth/login', { email: 'a@b.c', password: 'x' }),
    ).catch((error: unknown) => error);

    expect((failure as AxiosError).response?.data).toEqual({ code: 'invalid_credentials' });
    expect(seen.map((r) => r.url)).toEqual(['/auth/login']);
    expect(store.cleared).toBe(0);
    expect(unauthenticated).toBe(0);
  });

  it('logs out when the retried request is still 401', async () => {
    routes['/transactions'] = protectedRoute('never');
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    const failure = await withinGuard(createClient().get('/transactions')).catch(
      (error: unknown) => error,
    );

    expect((failure as AxiosError).response?.status).toBe(401);
    expect(seen.map((r) => r.url)).toEqual(['/transactions', '/auth/refresh', '/transactions']);
    expect(store.cleared).toBe(1);
    expect(unauthenticated).toBe(1);
  });

  it('ends the session when /auth/refresh answers 400', async () => {
    routes['/transactions'] = protectedRoute('never');
    routes['/auth/refresh'] = () => ({ status: 400, data: { code: 'validation_failed' } });

    const failure = await withinGuard(createClient().get('/transactions')).catch(
      (error: unknown) => error,
    );

    expect(readApiError(failure).status).toBe(400);
    expect(store.cleared).toBe(1);
    expect(unauthenticated).toBe(1);
  });

  it('keeps the session when /auth/refresh answers 503 and rejects with a retryable error', async () => {
    routes['/a'] = protectedRoute('new-access');
    routes['/b'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({ status: 503, data: {} });
    const client = createClient();

    const results = await withinGuard(Promise.allSettled([client.get('/a'), client.get('/b')]));

    expect(results.map(statusOf)).toEqual([503, 503]);
    expect(seen.filter((r) => r.url === '/auth/refresh')).toHaveLength(1);
    expect(store.access).toBe('old-access');
    expect(store.refresh).toBe('old-refresh');
    expect(store.cleared).toBe(0);
    expect(unauthenticated).toBe(0);
  });

  it('refreshes again on the next 401 after a 503 from /auth/refresh', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({ status: 503, data: {} });
    const client = createClient();
    await withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    const res = await withinGuard(client.get('/transactions'));

    expect(res.data).toEqual({ ok: true });
    expect(store.refresh).toBe('new-refresh');
    expect(unauthenticated).toBe(0);
  });

  it('keeps the session when /auth/refresh fails with a network error', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({ status: NETWORK_ERROR, data: null });

    const failure = await withinGuard(createClient().get('/transactions')).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AxiosError);
    expect(readApiError(failure).status).toBe(0);
    expect(store.access).toBe('old-access');
    expect(store.refresh).toBe('old-refresh');
    expect(store.cleared).toBe(0);
    expect(unauthenticated).toBe(0);
  });

  it('retries with the stored token without refreshing when another tab refreshed meanwhile', async () => {
    routes['/transactions'] = (config) => {
      if (config.headers.Authorization === 'Bearer tab-a-access') {
        return { status: 200, data: { ok: true } };
      }
      // Tab A refreshed while this request was in flight.
      store.access = 'tab-a-access';
      store.refresh = 'tab-a-refresh';

      return { status: 401, data: { code: 'unauthorized' } };
    };

    const res = await withinGuard(createClient().get('/transactions'));

    expect(res.data).toEqual({ ok: true });
    expect(seen.map((r) => r.url)).toEqual(['/transactions', '/transactions']);
    expect(unauthenticated).toBe(0);
  });

  it('keeps both tabs signed in when they refresh with the same rotated token', async () => {
    const server = new RotatingRefreshServer('old-refresh');
    routes['/data'] = (config) => server.data(config);
    routes['/auth/refresh'] = (config) => server.refresh(config);
    const loggedOut: string[] = [];
    const tabA = new ApiClient('http://api.test', store, () => loggedOut.push('A'));
    const tabB = new ApiClient('http://api.test', store, () => loggedOut.push('B'));

    const results = await withinGuard(Promise.allSettled([tabA.get('/data'), tabB.get('/data')]));

    expect(results.map(statusOf)).toEqual([200, 200]);
    expect(seen.filter((r) => r.url === '/auth/refresh')).toHaveLength(2);
    expect(loggedOut).toEqual([]);
    expect(store.cleared).toBe(0);
    expect(store.access).toBe('access-1');
    expect(store.refresh).toBe('refresh-1');
  });

  it('ends the session when the refresh token is rejected and no other tab replaced it', async () => {
    const server = new RotatingRefreshServer('someone-elses-refresh');
    routes['/data'] = (config) => server.data(config);
    routes['/auth/refresh'] = (config) => server.refresh(config);

    const failure = await withinGuard(createClient().get('/data')).catch((error: unknown) => error);

    expect(readApiError(failure).status).toBe(401);
    expect(store.cleared).toBe(1);
    expect(unauthenticated).toBe(1);
  });

  it('sends PATCH with a body', async () => {
    routes['/transactions/tx1'] = () => ({ status: 200, data: {} });

    await createClient().patch('/transactions/tx1', { ignored: true });

    expect(seen).toEqual([
      { url: '/transactions/tx1', authorization: 'Bearer old-access', body: { ignored: true } },
    ]);
  });
});
