/**
 * What a client needs from a failed API call: the HTTP status (0 when there was
 * no response, e.g. offline) and the stable error `code` of the body (CLN-002),
 * e.g. `invalid_credentials`, `requires_totp`, `totp_invalid`, `too_many_requests`.
 */
export interface ApiErrorInfo {
  readonly status: number;
  readonly code: string;
}

export const TOO_MANY_REQUESTS = 'too_many_requests';

export function readApiError(error: unknown): ApiErrorInfo {
  const response = property(error, 'response');
  const status = property(response, 'status');
  const code = property(property(response, 'data'), 'code');

  return {
    status: typeof status === 'number' ? status : 0,
    code: typeof code === 'string' ? code : status === 429 ? TOO_MANY_REQUESTS : '',
  };
}

function property(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return undefined;
  }

  return Reflect.get(value, key);
}
