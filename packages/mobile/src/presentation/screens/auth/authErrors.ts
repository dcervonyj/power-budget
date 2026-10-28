import { readApiError } from '@power-budget/shared-app';

export type RequestFailure =
  'tooManyAttempts' | 'emailInUse' | 'invalidCredentials' | 'invalidTotp' | 'other';

/** Error bodies carry a stable `code` (CLN-002/CLN-004); 409 is a duplicate account. */
export function classifyAuthError(error: unknown): RequestFailure {
  const { code, status } = readApiError(error);

  if (code === 'too_many_requests') {
    return 'tooManyAttempts';
  }
  if (code === 'invalid_credentials') {
    return 'invalidCredentials';
  }
  if (code === 'totp_invalid') {
    return 'invalidTotp';
  }
  if (status === 409) {
    return 'emailInUse';
  }

  return 'other';
}
