import { describe, expect, it } from 'vitest';
import { readApiError } from '../ApiError.js';

describe('readApiError', () => {
  it('reads status and code from an API error body', () => {
    const error = { response: { status: 403, data: { statusCode: 403, code: 'requires_totp' } } };

    expect(readApiError(error)).toEqual({ status: 403, code: 'requires_totp' });
  });

  it('treats a 429 without a body code as too_many_requests', () => {
    expect(readApiError({ response: { status: 429, data: 'Too Many Requests' } })).toEqual({
      status: 429,
      code: 'too_many_requests',
    });
  });

  it('gives status 0 and no code without a response (offline)', () => {
    expect(readApiError(new Error('Network Error'))).toEqual({ status: 0, code: '' });
    expect(readApiError(null)).toEqual({ status: 0, code: '' });
  });
});
