export type AppRoute =
  /** `returnToCurrent`: the session ended here; come back to this screen after login. */
  | { type: 'auth/login'; returnToCurrent?: boolean }
  | { type: 'auth/register' }
  | { type: 'auth/magic-link' }
  | { type: 'auth/totp-enrolment' }
  | { type: 'onboarding' }
  | { type: 'dashboard'; planId?: string }
  | { type: 'transactions'; filters?: Record<string, string> }
  | { type: 'plans' }
  | { type: 'plans/editor'; planId: string }
  | { type: 'bank-connections' }
  | { type: 'bank-connections/add' }
  | { type: 'categories' }
  | { type: 'settings' };
