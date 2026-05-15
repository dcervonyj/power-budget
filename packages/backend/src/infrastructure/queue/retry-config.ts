import type { BackoffOptions } from 'bullmq';

/**
 * Exponential backoff: 30s, 2m, 10m, 1h, 6h (5 attempts max, then DLQ).
 * Per ARCHITECTURE.md §9.
 */
export const RETRY_DELAYS_MS = [
  30_000, // 30s
  120_000, // 2m
  600_000, // 10m
  3_600_000, // 1h
  21_600_000, // 6h
];

export const MAX_ATTEMPTS = 5;

export const DEFAULT_JOB_OPTIONS = {
  attempts: MAX_ATTEMPTS,
  backoff: {
    type: 'custom',
  } satisfies BackoffOptions,
  removeOnComplete: { count: 100, age: 24 * 3600 },
  removeOnFail: false, // keep failed jobs for inspection
} as const;

/**
 * Custom backoff strategy: index into RETRY_DELAYS_MS array.
 * Register this with BullMQ worker's backoffStrategy option.
 */
export function customBackoffStrategy(attemptsMade: number): number {
  const idx = Math.min(attemptsMade, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[idx] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
}
