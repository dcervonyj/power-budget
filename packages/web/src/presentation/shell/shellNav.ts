import type { MessageDescriptor } from 'react-intl';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';
import type { IconName } from '../glass/atoms/iconPaths.js';

/** Main destinations: the header nav shows overview / transactions / plan, the tab bar adds to-sort. */
export type ShellNavItem = 'overview' | 'transactions' | 'toSort' | 'plan';

export interface ShellNavLink {
  readonly item: ShellNavItem;
  readonly to: string;
  readonly icon: IconName;
  readonly label: MessageDescriptor;
}

export const TO_SORT_PATH = `${ROUTE_PATHS.transactions}?status=unmapped`;

const OVERVIEW: ShellNavLink = {
  item: 'overview',
  to: ROUTE_PATHS.dashboard,
  icon: 'dashboard',
  label: { id: 'shell.nav.overview', defaultMessage: 'Overview' },
};

const TRANSACTIONS: ShellNavLink = {
  item: 'transactions',
  to: ROUTE_PATHS.transactions,
  icon: 'transactions',
  label: { id: 'shell.nav.transactions', defaultMessage: 'Transactions' },
};

const TO_SORT: ShellNavLink = {
  item: 'toSort',
  to: TO_SORT_PATH,
  icon: 'tag',
  label: { id: 'shell.nav.toSort', defaultMessage: 'To sort' },
};

const PLAN: ShellNavLink = {
  item: 'plan',
  to: ROUTE_PATHS.plans,
  icon: 'plan',
  label: { id: 'shell.nav.plan', defaultMessage: 'Plan' },
};

export const HEADER_LINKS: readonly ShellNavLink[] = [OVERVIEW, TRANSACTIONS, PLAN];

/** Mirrors the mobile tabs (Q6): Overview, Transactions, To sort, Plan. */
export const TAB_LINKS: readonly ShellNavLink[] = [OVERVIEW, TRANSACTIONS, TO_SORT, PLAN];

/** The destination a URL belongs to; account pages (categories, settings, ...) have none. */
export function activeNavItem(pathname: string, search: string): ShellNavItem | null {
  if (pathname === ROUTE_PATHS.dashboard) {
    return 'overview';
  }
  if (isUnder(pathname, ROUTE_PATHS.transactions)) {
    return new URLSearchParams(search).get('status') === 'unmapped' ? 'toSort' : 'transactions';
  }
  if (isUnder(pathname, ROUTE_PATHS.plans)) {
    return 'plan';
  }

  return null;
}

/** The header has no to-sort item: sorting is part of transactions there. */
export function headerItemOf(active: ShellNavItem | null): ShellNavItem | null {
  return active === 'toSort' ? 'transactions' : active;
}

function isUnder(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}
