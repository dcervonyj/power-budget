import type { HttpClient } from '../../infrastructure/api-client/HttpClient.js';
import type { UpdateUserProfileDto, UserProfileDto } from '../../contract/dto.js';

export interface OnboardingChoices {
  readonly language: string;
  readonly baseCurrency: string;
  /** Currencies tracked next to the base currency; left unchanged on the profile when omitted. */
  readonly interestingCurrencies?: readonly string[];
}

type ProfileLocale = NonNullable<UpdateUserProfileDto['locale']>;
type ProfileCurrency = NonNullable<UpdateUserProfileDto['baseCurrency']>;

/** The locales and currencies `PATCH /users/me` accepts; a wizard choice outside them is not sent. */
const PROFILE_LOCALES: readonly ProfileLocale[] = ['en', 'uk', 'ru', 'pl'];
const PROFILE_CURRENCIES: readonly ProfileCurrency[] = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'UAH',
  'RUB',
  'CHF',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
];

/**
 * Onboarding completion on the profile (CLN-073): read with `GET /users/me`, stored with
 * `PATCH /users/me`, so it survives sign-out and a reinstall. Shared by web and mobile.
 */
export class OnboardingApi {
  constructor(private readonly http: Pick<HttpClient, 'get' | 'patch'>) {}

  async isCompleted(): Promise<boolean> {
    return (await this.readProfile()).onboardingCompleted;
  }

  /** The whole profile, for a client that wants more than the completion flag from the one read. */
  async readProfile(): Promise<UserProfileDto> {
    const res = await this.http.get<UserProfileDto>('/users/me');

    return res.data;
  }

  /** Saves the chosen language and base currency and marks onboarding completed in one request. */
  async complete(choices: OnboardingChoices): Promise<void> {
    const locale = PROFILE_LOCALES.find((code) => code === choices.language);
    const baseCurrency = PROFILE_CURRENCIES.find((code) => code === choices.baseCurrency);
    const body: UpdateUserProfileDto = {
      onboardingCompleted: true,
      ...(choices.interestingCurrencies !== undefined
        ? { interestingCurrencies: [...choices.interestingCurrencies] }
        : {}),
      ...(locale !== undefined ? { locale } : {}),
      ...(baseCurrency !== undefined ? { baseCurrency } : {}),
    };
    await this.http.patch<UserProfileDto>('/users/me', body);
  }
}
