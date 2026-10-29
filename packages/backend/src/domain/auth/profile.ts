import type { CurrencyCode, HouseholdId, UserId } from '@power-budget/core';
import type { LocaleCode } from './entities.js';

/** The signed-in user's profile and preferences (CLN-011). */
export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly localePreference: LocaleCode | null;
  readonly defaultLocale: LocaleCode;
  /** null: the user follows the household's base currency. */
  readonly baseCurrency: CurrencyCode | null;
  /** IANA time zone, e.g. `Europe/Warsaw`. */
  readonly timezone: string;
  /** False until onboarding is completed (CLN-073). */
  readonly onboardingCompleted: boolean;
  readonly householdId: HouseholdId | null;
  readonly householdBaseCurrency: CurrencyCode | null;
}

export interface UserProfilePatch {
  readonly displayName?: string;
  readonly locale?: LocaleCode;
  readonly baseCurrency?: CurrencyCode;
  readonly timezone?: string;
  readonly onboardingCompleted?: boolean;
}

export interface UserProfileRepository {
  findById(id: UserId): Promise<UserProfile | null>;
  update(id: UserId, patch: UserProfilePatch): Promise<void>;
}

export const UserPreferences = {
  /** Throws USER_PREFERENCE_INVALID for anything but an IANA time zone name. */
  assertTimeZone(timezone: string): void {
    if (!isTimeZone(timezone)) {
      throw new Error(`USER_PREFERENCE_INVALID: Unknown time zone ${JSON.stringify(timezone)}`);
    }
  },

  effectiveLocale(profile: UserProfile): LocaleCode {
    return profile.localePreference ?? profile.defaultLocale;
  },

  effectiveBaseCurrency(profile: UserProfile): CurrencyCode | null {
    return profile.baseCurrency ?? profile.householdBaseCurrency;
  },
};

function isTimeZone(timezone: string): boolean {
  if (timezone.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });

    return true;
  } catch {
    return false;
  }
}
