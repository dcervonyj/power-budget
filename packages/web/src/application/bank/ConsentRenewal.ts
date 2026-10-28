// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import type { BankConnection } from '../../infrastructure/api/BankConnectionMapper.js';

export type ConsentState =
  | { readonly kind: 'active' }
  | { readonly kind: 'expiring'; readonly daysLeft: number }
  | { readonly kind: 'expired' }
  | { readonly kind: 'reconnect' }
  | { readonly kind: 'disconnected' };

export const RENEWAL_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the bank consent of a connection stands: the card and the banners both read this. */
export function consentStateOf(connection: BankConnection, now: Date): ConsentState {
  if (connection.status === 'disconnected') {
    return { kind: 'disconnected' };
  }
  if (connection.status === 'reconnect_required') {
    return { kind: 'reconnect' };
  }
  const expiresAt = connection.expiresAt;
  if (connection.status === 'expired' || (expiresAt !== null && expiresAt <= now)) {
    return { kind: 'expired' };
  }
  if (expiresAt !== null && expiresAt.getTime() - now.getTime() < RENEWAL_WINDOW_DAYS * DAY_MS) {
    return {
      kind: 'expiring',
      daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS),
    };
  }

  return { kind: 'active' };
}

/** Connections whose consent runs out within a week or already has. */
export function connectionsToRenew(
  connections: readonly BankConnection[],
  now: Date,
): BankConnection[] {
  return connections.filter((connection) => isRenewalDue(consentStateOf(connection, now)));
}

function isRenewalDue(state: ConsentState): boolean {
  return state.kind === 'expiring' || state.kind === 'expired';
}
