/**
 * The web route table: `App.tsx` declares its routes with these paths and the
 * navigation adapter builds its URLs from them, so the two cannot drift apart.
 */
export const ROUTE_PATHS = {
  login: '/login',
  register: '/register',
  magicLink: '/auth/magic-link',
  totpEnroll: '/auth/totp-enroll',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  transactions: '/transactions',
  transactionDetail: '/transactions/:id?',
  plans: '/plans',
  planEditor: '/plans/:id',
  planDashboard: '/plans/:id/dashboard',
  bankConnections: '/bank-connections',
  addBankConnection: '/bank-connections/new',
  categories: '/categories',
  settings: '/settings',
} as const;

/** Screens a session-end redirect must not come back to: the user is signing in there. */
export const PUBLIC_AUTH_PATHS: readonly string[] = [
  ROUTE_PATHS.login,
  ROUTE_PATHS.register,
  ROUTE_PATHS.magicLink,
];
