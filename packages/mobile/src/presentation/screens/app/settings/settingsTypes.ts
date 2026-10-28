import type { UserProfileDto } from '@power-budget/shared-app/contract';
import type { ThemePreference } from '../../../theme/index.js';

export type SettingsLocale = UserProfileDto['locale'];

export type SettingsCurrency = NonNullable<UserProfileDto['baseCurrency']>;

export type SettingsLoadState = 'loading' | 'ready' | 'error';

export type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SETTINGS_LOCALES: readonly SettingsLocale[] = ['en', 'pl', 'uk', 'ru'];

/** Language names shown in their own language, so they never need translating. */
export const LOCALE_NAMES: Record<SettingsLocale, string> = {
  en: 'English',
  pl: 'Polski',
  uk: 'Українська',
  ru: 'Русский',
};

export const SETTINGS_CURRENCIES: readonly SettingsCurrency[] = [
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

export interface SettingsViewProps {
  readonly loadState: SettingsLoadState;
  readonly email: string;
  readonly nameDraft: string;
  readonly nameSave: SettingsSaveState;
  readonly preference: ThemePreference;
  readonly locale: SettingsLocale;
  readonly baseCurrency: SettingsCurrency | null;
  readonly preferencesError: boolean;
  readonly biometricAvailable: boolean;
  readonly biometricEnabled: boolean;
  readonly biometricError: boolean;
  readonly signingOut: boolean;
  readonly onRetry: () => void;
  readonly onNameChange: (name: string) => void;
  readonly onNameSave: () => void;
  readonly onPreferenceChange: (preference: ThemePreference) => void;
  readonly onLocaleChange: (locale: SettingsLocale) => void;
  readonly onCurrencyChange: (currency: SettingsCurrency) => void;
  readonly onBiometricChange: (enabled: boolean) => void;
  readonly onSignOut: () => void;
}
