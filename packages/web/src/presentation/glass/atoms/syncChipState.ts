export type SyncChipState =
  | { readonly kind: 'live' }
  | { readonly kind: 'bank-age'; readonly ageMinutes: number }
  | { readonly kind: 'updating' }
  | { readonly kind: 'renew' }
  | { readonly kind: 'stale' }
  | { readonly kind: 'cooldown'; readonly minutesLeft: number };

const MINUTE_MS = 60_000;
const LIVE_WITHIN_MINUTES = 1;
const STALE_AFTER_MINUTES = 24 * 60;

/** Maps the last successful sync time of a connection to a chip state; no sync yet is stale. */
export function deriveSyncChipState(lastSuccessfulAt: Date | null, now: Date): SyncChipState {
  if (lastSuccessfulAt === null) {
    return { kind: 'stale' };
  }
  const ageMinutes = Math.max(
    0,
    Math.floor((now.getTime() - lastSuccessfulAt.getTime()) / MINUTE_MS),
  );
  if (ageMinutes <= LIVE_WITHIN_MINUTES) {
    return { kind: 'live' };
  }
  if (ageMinutes >= STALE_AFTER_MINUTES) {
    return { kind: 'stale' };
  }

  return { kind: 'bank-age', ageMinutes };
}
