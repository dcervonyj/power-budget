import { readApiError, type HouseholdsApi, type SecureTokenStore } from '@power-budget/shared-app';

/** Why an invite link could not be accepted (CLN-006 error codes). */
export type AcceptInviteError =
  | 'missing_token'
  | 'email_mismatch'
  | 'invite_not_found'
  | 'invite_expired'
  | 'invite_already_used'
  | 'already_in_household'
  | 'household_full'
  | 'household_not_empty'
  | 'failed';

export type AcceptInviteOutcome =
  | { readonly kind: 'joined'; readonly householdId: string }
  | { readonly kind: 'failed'; readonly error: AcceptInviteError };

export type AcceptInviteApi = Pick<HouseholdsApi, 'acceptInvite'>;
export type AcceptInviteTokens = Pick<SecureTokenStore, 'getRefreshToken' | 'setTokens'>;

const KNOWN_ERRORS: readonly AcceptInviteError[] = [
  'email_mismatch',
  'invite_not_found',
  'invite_expired',
  'invite_already_used',
  'already_in_household',
  'household_full',
  'household_not_empty',
];

/**
 * Accepts the invite from the email link (`/invite/accept?token=`). The API answers
 * with an access token scoped to the joined household; the refresh token stays.
 */
export class AcceptInvite {
  constructor(
    private readonly households: AcceptInviteApi,
    private readonly tokens: AcceptInviteTokens,
  ) {}

  async execute(token: string): Promise<AcceptInviteOutcome> {
    if (token.trim() === '') {
      return { kind: 'failed', error: 'missing_token' };
    }
    try {
      // Read before joining: the join cannot be undone, so a missing session must stop it first.
      const refreshToken = this.tokens.getRefreshToken();
      if (refreshToken === null) {
        return { kind: 'failed', error: 'failed' };
      }
      const joined = await this.households.acceptInvite(token);
      await this.tokens.setTokens(joined.accessToken, refreshToken);

      return { kind: 'joined', householdId: joined.householdId };
    } catch (err) {
      return { kind: 'failed', error: classifyAcceptError(err) };
    }
  }
}

function classifyAcceptError(err: unknown): AcceptInviteError {
  const { code } = readApiError(err);
  for (const known of KNOWN_ERRORS) {
    if (known === code) {
      return known;
    }
  }

  return 'failed';
}
