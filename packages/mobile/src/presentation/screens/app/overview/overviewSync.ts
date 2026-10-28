import type { AccountDto, BankConnectionDto } from '@power-budget/shared-app/contract';
import { deriveSyncChipState, type SyncChipState } from '../../../glass/atoms/syncChipState.js';

/**
 * The viewer's own bank sync as one chip (only the caller's own connections and accounts are
 * readable). No live connection: no chip. A connection that needs a new consent wins (the user has
 * to act). Otherwise the oldest of the live connections decides, each as fresh as its newest
 * synced account; one that has never synced makes the chip stale. Same rule as the web shell.
 */
export function summariseSync(
  connections: readonly BankConnectionDto[],
  accounts: readonly AccountDto[],
  now: Date,
): SyncChipState | null {
  const live = connections.filter(isNotDisconnected);
  if (live.length === 0) {
    return null;
  }
  if (live.some(needsConsent)) {
    return { kind: 'renew' };
  }
  const perConnection = live.map((connection) => newestSyncOf(connection.id, accounts));
  if (perConnection.some(Number.isNaN)) {
    return deriveSyncChipState(null, now);
  }

  return deriveSyncChipState(new Date(Math.min(...perConnection)), now);
}

/** Newest sync among the connection's accounts; NaN when none has synced yet. */
function newestSyncOf(connectionId: string, accounts: readonly AccountDto[]): number {
  const times = accounts
    .filter((account) => account.connectionId === connectionId)
    .map(lastSyncOf)
    .filter(isKnownTime);

  return times.length === 0 ? Number.NaN : Math.max(...times);
}

function isNotDisconnected(connection: BankConnectionDto): boolean {
  return connection.status !== 'disconnected';
}

function needsConsent(connection: BankConnectionDto): boolean {
  return connection.status === 'expired' || connection.status === 'reconnect_required';
}

function lastSyncOf(account: AccountDto): number {
  return account.lastSyncedAt === null ? Number.NaN : Date.parse(account.lastSyncedAt);
}

function isKnownTime(time: number): boolean {
  return !Number.isNaN(time);
}
