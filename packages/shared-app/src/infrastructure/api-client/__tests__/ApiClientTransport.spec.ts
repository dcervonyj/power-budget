import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../ApiClient.js';
import { readApiError } from '../ApiError.js';
import { HttpError, NETWORK_CODE } from '../HttpError.js';
import type { SecureTokenStore } from '../../tokens/SecureTokenStore.js';

const BASE_URL = 'http://api.test/';
const REVOKE_TIMEOUT_MS = 5000;

class FixedTokenStore implements SecureTokenStore {
  getAccessToken(): string | null {
    return 'access';
  }

  getRefreshToken(): string | null {
    return 'refresh';
  }

  async setTokens(): Promise<void> {}

  async clearTokens(): Promise<void> {}
}

interface Call {
  input: string;
  init: RequestInit;
}

function clientWith(fetchFn: (input: string, init: RequestInit) => Promise<Response>): ApiClient {
  return new ApiClient(BASE_URL, new FixedTokenStore(), undefined, undefined, fetchFn);
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to fail');
}

describe('ApiClient transport', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the bearer token, a JSON body and joins the base URL without a double slash', async () => {
    const calls: Call[] = [];
    const client = clientWith(async (input, init) => {
      calls.push({ input, init });

      return new Response(JSON.stringify({ id: 1 }), { status: 201, headers: { 'x-extra': 'v' } });
    });

    const res = await client.post('/plans', { name: 'Home' });

    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 1 });
    expect(res.headers['x-extra']).toBe('v');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe('http://api.test/plans');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{"name":"Home"}');
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get('Authorization')).toBe('Bearer access');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('sends no body for a GET and keeps absolute URLs as they are', async () => {
    const calls: Call[] = [];
    const client = clientWith(async (input, init) => {
      calls.push({ input, init });

      return new Response(null, { status: 204 });
    });

    const res = await client.get('https://other.test/x');

    expect(res.data).toBe('');
    expect(calls[0]?.input).toBe('https://other.test/x');
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('returns a non-JSON body as text', async () => {
    const client = clientWith(async () => new Response('plain text', { status: 200 }));

    const res = await client.get('/health');

    expect(res.data).toBe('plain text');
  });

  it('maps a 4xx answer to an HttpError that readApiError understands', async () => {
    const client = clientWith(
      async () => new Response(JSON.stringify({ code: 'totp_invalid' }), { status: 403 }),
    );

    const failure = await failureOf(client.get('/things'));

    expect(failure).toBeInstanceOf(HttpError);
    expect((failure as HttpError).config.url).toBe('/things');
    expect(readApiError(failure)).toEqual({ status: 403, code: 'totp_invalid' });
  });

  it('maps a 429 without a code to too_many_requests', async () => {
    const client = clientWith(async () => new Response('', { status: 429 }));

    const failure = await failureOf(client.get('/things'));

    expect(readApiError(failure)).toEqual({ status: 429, code: 'too_many_requests' });
  });

  it('maps a network failure to an HttpError without a response (status 0)', async () => {
    const client = clientWith(async () => {
      throw new TypeError('Failed to fetch');
    });

    const failure = await failureOf(client.get('/things'));

    expect(failure).toBeInstanceOf(HttpError);
    expect((failure as HttpError).code).toBe(NETWORK_CODE);
    expect(readApiError(failure)).toEqual({ status: 0, code: '' });
  });

  it('aborts the revocation request after the timeout and still completes the sign-out', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const client = clientWith(function hang(_input, init) {
      const { signal } = init;
      if (signal) {
        signals.push(signal);
      }

      return new Promise<Response>(function never(_resolve, reject) {
        signal?.addEventListener('abort', function onAbort() {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const signedOut = client.signOut();
    await vi.advanceTimersByTimeAsync(REVOKE_TIMEOUT_MS);
    await signedOut;

    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
  });
});
