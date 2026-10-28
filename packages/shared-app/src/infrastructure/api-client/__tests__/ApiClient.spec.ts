import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, type RefreshRaceTiming } from '../ApiClient.js';
import { readApiError } from '../ApiError.js';
import { HttpError } from '../HttpError.js';
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

/** What a route sees of a request: the path (without base URL), headers and parsed JSON body. */
interface FakeConfig {
  url: string;
  headers: { Authorization?: string };
  data: unknown;
}

type Route = (config: FakeConfig) => RouteResult | Promise<RouteResult>;

/** Status 0 stands for "no response" (offline, DNS, connection reset). */
const NETWORK_ERROR = 0;

const BASE_URL = 'http://api.test';

function authorizationOf(headers: Headers): FakeConfig['headers'] {
  const authorization = headers.get('Authorization');

  return authorization === null ? {} : { Authorization: authorization };
}

type FetchFake = (input: string, init: RequestInit) => Promise<Response>;

const HANG_GUARD_MS = 1000;

function respond(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status });
}

/** Fast enough for the hang guard; the production default waits 3 s. */
const RACE_TIMING: RefreshRaceTiming = { waitMs: 200, pollMs: 5 };

interface RefreshLatency {
  /** Time to answer 201 after the token was taken (Redis SET, household lookup, JWT). */
  issueMs: number;
  /** Time to answer 401 for a token that was already taken. */
  rejectMs: number;
}

/**
 * The backend's refresh semantics: a refresh token is single use (Redis GETDEL on
 * arrival), each refresh rotates the pair, and only the latest access token is accepted.
 */
class RotatingRefreshServer {
  private validAccess = 'access-0';
  private readonly refreshTokens: Set<string>;
  private issued = 0;

  constructor(
    refreshToken: string,
    private readonly latency: RefreshLatency = { issueMs: 20, rejectMs: 20 },
  ) {
    this.refreshTokens = new Set([refreshToken]);
  }

  data(config: FakeConfig): RouteResult {
    if (config.headers.Authorization === `Bearer ${this.validAccess}`) {
      return { status: 200, data: { ok: true } };
    }

    return { status: 401, data: { code: 'unauthorized' } };
  }

  async refresh(config: FakeConfig): Promise<RouteResult> {
    const body: unknown = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const refreshToken = Reflect.get(Object(body), 'refreshToken');
    if (typeof refreshToken !== 'string' || !this.refreshTokens.delete(refreshToken)) {
      await delay(this.latency.rejectMs);

      return { status: 401, data: { code: 'invalid_credentials' } };
    }
    await delay(this.latency.issueMs);
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
  let fetchFake: FetchFake;
  let seen: SeenRequest[];
  let routes: Record<string, Route>;
  let store: InMemoryTokenStore;
  let unauthenticated: number;

  function createClient(): ApiClient {
    return new ApiClient(
      BASE_URL,
      store,
      () => {
        unauthenticated += 1;
      },
      RACE_TIMING,
      (input, init) => fetchFake(input, init),
    );
  }

  beforeEach(() => {
    seen = [];
    routes = {};
    store = new InMemoryTokenStore();
    unauthenticated = 0;
    fetchFake = async (input, init) => {
      const url = input.replace(BASE_URL, '');
      const headers = new Headers(init.headers);
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      seen.push({ url, authorization: headers.get('Authorization') ?? '', body });
      const route = routes[url];
      const config: FakeConfig = {
        url,
        headers: authorizationOf(headers),
        data: body,
      };
      const { status, data } = route ? await route(config) : { status: 404, data: {} };
      if (status === NETWORK_ERROR) {
        throw new TypeError('Failed to fetch');
      }

      return respond(status, data);
    };
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

    expect(failure).toBeInstanceOf(HttpError);
    expect((failure as HttpError).response?.status).toBe(401);
    expect((failure as HttpError).config?.url).toBe('/auth/refresh');
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

    expect((failure as HttpError).response?.data).toEqual({ code: 'invalid_credentials' });
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

    expect((failure as HttpError).response?.status).toBe(401);
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

    expect(failure).toBeInstanceOf(HttpError);
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

  it.each<[string, RefreshLatency]>([
    ['the winner answers first', { issueMs: 20, rejectMs: 20 }],
    ['the loser is rejected before the winner stored its pair', { issueMs: 60, rejectMs: 1 }],
  ])('keeps both tabs signed in when they refresh with the same token (%s)', async (_, latency) => {
    const server = new RotatingRefreshServer('old-refresh', latency);
    routes['/data'] = (config) => server.data(config);
    routes['/auth/refresh'] = (config) => server.refresh(config);
    const loggedOut: string[] = [];
    const tabA = new ApiClient(
      BASE_URL,
      store,
      () => loggedOut.push('A'),
      RACE_TIMING,
      (input, init) => fetchFake(input, init),
    );
    const tabB = new ApiClient(
      BASE_URL,
      store,
      () => loggedOut.push('B'),
      RACE_TIMING,
      (input, init) => fetchFake(input, init),
    );

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

  it('surfaces a failure to store the rotated pair as that error, without ending the session', async () => {
    const storageFull = new Error('QuotaExceededError');
    store.setTokens = async (): Promise<void> => {
      throw storageFull;
    };
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    const failure = await withinGuard(createClient().get('/transactions')).catch(
      (error: unknown) => error,
    );

    expect(failure).toBe(storageFull);
    expect(store.cleared).toBe(0);
    expect(unauthenticated).toBe(0);
  });

  it('sends PATCH with a body', async () => {
    routes['/transactions/tx1'] = () => ({ status: 200, data: {} });

    await createClient().patch('/transactions/tx1', { ignored: true });

    expect(seen).toEqual([
      { url: '/transactions/tx1', authorization: 'Bearer old-access', body: { ignored: true } },
    ]);
  });

  it('does not store tokens from a refresh that was in flight when the session was invalidated', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));

      return { status: 201, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } };
    };
    const client = createClient();

    const pending = withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.invalidateSession();
    const outcome = await pending;

    expect(outcome).toBeInstanceOf(Error);
    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
    expect(unauthenticated).toBe(1);
  });

  it('clears the tokens when sign-out lands while the refreshed pair is being stored', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });
    store.setTokens = async (accessToken, refreshToken) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      store.access = accessToken;
      store.refresh = refreshToken;
    };
    const client = createClient();

    const pending = withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await client.invalidateSession();
    await pending;

    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
  });

  it('revokes with a refreshed access token when the stored one has expired', async () => {
    routes['/auth/logout'] = (config) =>
      config.headers.Authorization === 'Bearer new-access'
        ? { status: 204, data: {} }
        : { status: 401, data: {} };
    routes['/auth/refresh'] = () => ({
      status: 201,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    });

    await createClient().signOut();

    expect(seen.map((request) => request.url)).toEqual([
      '/auth/logout',
      '/auth/refresh',
      '/auth/logout',
    ]);
    expect(seen[2]?.body).toEqual({ refreshToken: 'new-refresh' });
    expect(store.access).toBeNull();
  });

  it('clears the local tokens and never throws when the revocation fails', async () => {
    routes['/auth/logout'] = () => ({ status: 503, data: {} });

    await expect(createClient().signOut()).resolves.toBeUndefined();

    expect(store.access).toBeNull();
    expect(store.refresh).toBeNull();
  });

  it('revokes the rotated token when a refresh is in flight', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));

      return { status: 201, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } };
    };
    routes['/auth/logout'] = () => ({ status: 204, data: {} });
    const client = createClient();

    const pending = withinGuard(client.get('/transactions'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.signOut();
    await pending;

    const logout = seen.filter((request) => request.url === '/auth/logout');
    expect(logout).toHaveLength(1);
    expect(logout[0]?.body).toEqual({ refreshToken: 'new-refresh' });
    expect(logout[0]?.authorization).toBe('Bearer new-access');
  });

  it('does not start a refresh while the sign-out is waiting', async () => {
    routes['/transactions'] = protectedRoute('new-access');
    routes['/auth/refresh'] = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));

      return { status: 201, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } };
    };
    routes['/auth/logout'] = () => ({ status: 204, data: {} });
    const client = createClient();

    const first = withinGuard(client.get('/transactions'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const signingOut = client.signOut();
    store.access = 'stale-access';
    const late = withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    await signingOut;
    await first;

    expect(await late).toBeInstanceOf(Error);
    expect(seen.filter((request) => request.url === '/auth/refresh')).toHaveLength(1);
    const logout = seen.filter((request) => request.url === '/auth/logout');
    expect(logout[0]?.body).toEqual({ refreshToken: 'new-refresh' });
  });

  it('leaves a later login untouched when a stalled revocation or refresh settles after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let releaseRefresh: () => void = () => undefined;
      routes['/transactions'] = protectedRoute('new-access');
      routes['/auth/refresh'] = () =>
        new Promise<RouteResult>((resolve) => {
          releaseRefresh = () => {
            resolve({
              status: 201,
              data: { accessToken: 'late-access', refreshToken: 'late-refresh' },
            });
          };
        });
      routes['/auth/logout'] = () => new Promise<RouteResult>(() => undefined);
      const client = createClient();

      const pending = client.get('/transactions').catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10);
      let settled = false;
      const signingOut = client.signOut().then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(11000);
      await signingOut;
      expect(settled).toBe(true);
      expect(store.access).toBeNull();

      await store.setTokens('next-access', 'next-refresh');
      releaseRefresh();
      await vi.advanceTimersByTimeAsync(100);
      await pending;

      expect(store.access).toBe('next-access');
      expect(store.refresh).toBe('next-refresh');
      const logout = seen.filter((request) => request.url === '/auth/logout');
      expect(logout.every((request) => JSON.stringify(request.body).includes('old-refresh'))).toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late 401 for a request that started under an earlier session', async () => {
    routes['/transactions'] = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));

      return { status: 401, data: {} };
    };
    routes['/auth/refresh'] = () => ({ status: 400, data: {} });
    const client = createClient();

    const late = withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.invalidateSession();
    await store.setTokens('next-access', 'next-refresh');
    const endedBefore = unauthenticated;
    const outcome = await late;

    expect(outcome).toBeInstanceOf(Error);
    expect(seen.filter((request) => request.url === '/auth/refresh')).toHaveLength(0);
    expect(store.access).toBe('next-access');
    expect(store.refresh).toBe('next-refresh');
    expect(unauthenticated).toBe(endedBefore);
  });

  it('does not let a stale refresh rejection end a later login', async () => {
    routes['/transactions'] = () => ({ status: 401, data: {} });
    routes['/auth/refresh'] = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));

      return { status: 400, data: {} };
    };
    const client = createClient();

    const pending = withinGuard(client.get('/transactions')).catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.invalidateSession();
    await store.setTokens('next-access', 'next-refresh');
    const endedBefore = unauthenticated;
    await pending;

    expect(store.access).toBe('next-access');
    expect(unauthenticated).toBe(endedBefore);
  });

  it('bumps the session id on sign-out and on expiry', async () => {
    routes['/transactions'] = () => ({ status: 401, data: {} });
    routes['/auth/refresh'] = () => ({ status: 400, data: {} });
    const client = createClient();
    const start = client.sessionId;

    await client.invalidateSession();
    expect(client.sessionId).toBe(start + 1);

    store.access = 'old-access';
    store.refresh = 'old-refresh';
    await withinGuard(client.get('/transactions')).catch(() => undefined);

    expect(client.sessionId).toBe(start + 2);
    expect(unauthenticated).toBe(2);
  });
});
