import type { BankConnection, ConsentReminderKind } from './entities.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Determines what consent reminder (if any) should be sent for a connection.
 * Per ARCHITECTURE.md §5.2 + PRD §4.10: 7d / 1d / on-expiry.
 */
export class ConsentExpiryPolicy {
  /**
   * Returns the reminder kind if a reminder should be sent now, or null.
   * @param connection - the bank connection to evaluate
   * @param now - the current time (injected for testability)
   */
  static evaluate(connection: BankConnection, now: Date): ConsentReminderKind | null {
    if (!connection.expiresAt) return null;
    if (connection.status === 'disconnected') return null;

    const msUntilExpiry = connection.expiresAt.getTime() - now.getTime();

    if (msUntilExpiry <= 0) {
      return 'expired';
    }
    if (msUntilExpiry <= ONE_DAY_MS) {
      return 'one_day';
    }
    if (msUntilExpiry <= SEVEN_DAYS_MS) {
      return 'seven_days';
    }
    return null;
  }

  /**
   * Returns true if the consent has expired (past expiresAt).
   */
  static isExpired(connection: BankConnection, now: Date): boolean {
    if (!connection.expiresAt) return false;
    return connection.expiresAt.getTime() <= now.getTime();
  }

  /**
   * Returns true if the consent will expire within the given window (ms).
   */
  static expiresWithin(connection: BankConnection, windowMs: number, now: Date): boolean {
    if (!connection.expiresAt) return false;
    const msUntilExpiry = connection.expiresAt.getTime() - now.getTime();
    return msUntilExpiry > 0 && msUntilExpiry <= windowMs;
  }
}
