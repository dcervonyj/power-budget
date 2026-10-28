/** How long a producer waits for Redis before the enqueue is reported as failed. */
export const ENQUEUE_TIMEOUT_MS = 5_000;

export class QueueUnavailableError extends Error {
  constructor(what: string, timeoutMs: number) {
    super(`Queue unavailable: ${what} not accepted by Redis within ${timeoutMs} ms`);
    this.name = 'QueueUnavailableError';
  }
}

/**
 * Bounds a BullMQ producer call (CLN-056). BullMQ waits for the Redis connection to be ready
 * before sending a command, and ioredis keeps reconnecting forever, so with Redis down (also at
 * startup) `queue.add` never settles and an API request would hang. This rejects after
 * `timeoutMs`; the underlying add may still complete later, which is safe because every
 * producer uses a deterministic jobId / deduplication id.
 */
export async function boundedEnqueue<T>(
  operation: Promise<T>,
  what: string,
  timeoutMs: number = ENQUEUE_TIMEOUT_MS,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new QueueUnavailableError(what, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
    // A late rejection of the abandoned operation must not become an unhandled rejection.
    operation.catch(ignoreLateFailure);
  }
}

function ignoreLateFailure(): void {
  // Already reported to the caller as a timeout.
}
