const DELTA_SECONDS = /^\d+$/;

/**
 * A `Retry-After` header as a point in time (RFC 9110 §10.2.3): either delta-seconds
 * (`120`) or an HTTP-date (`Wed, 21 Oct 2026 07:28:00 GMT`). Null when the header is
 * absent or unreadable.
 */
export function parseRetryAfter(value: string | null, now: Date): Date | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (DELTA_SECONDS.test(trimmed)) {
    return new Date(now.getTime() + Number(trimmed) * 1000);
  }
  const at = Date.parse(trimmed);

  return Number.isNaN(at) ? null : new Date(at);
}
