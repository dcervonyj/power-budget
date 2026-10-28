/** The part of the answer that `readApiError` and callers look at. */
export interface HttpErrorResponse {
  readonly status: number;
  readonly data: unknown;
}

/** The request that failed; `url` is the path as the caller passed it (before the base URL). */
export interface HttpErrorRequest {
  readonly url: string;
  readonly method: string;
}

export const TIMEOUT_CODE = 'ECONNABORTED';
export const NETWORK_CODE = 'ERR_NETWORK';
export const BAD_STATUS_CODE = 'ERR_BAD_RESPONSE';

/**
 * Thrown for every failed call: a non-2xx answer carries `response`; a network failure or a
 * timeout has none (`readApiError` then reports status 0).
 */
export class HttpError extends Error {
  readonly response: HttpErrorResponse | undefined;

  constructor(
    message: string,
    readonly code: string,
    readonly config: HttpErrorRequest,
    response?: HttpErrorResponse,
  ) {
    super(message);
    this.name = 'HttpError';
    this.response = response;
  }
}
