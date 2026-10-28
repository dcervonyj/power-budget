import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { UpdateUserProfileDto, UserProfileDto } from '@power-budget/shared-app/contract';
import { apiClient, biometricUnlockService, tokenStore } from '../../../../infrastructure/index.js';
import { useAppLocale } from '../../../LocaleProvider.js';
import { useTheme } from '../../../theme/index.js';
import type {
  SettingsCurrency,
  SettingsLoadState,
  SettingsLocale,
  SettingsSaveState,
  SettingsViewProps,
} from './settingsTypes.js';

const SAVED_VISIBLE_MS = 2500;

/** Settings data container: GET/PATCH /users/me, the theme runtime, biometrics and sign out. */
export function useSettings(): SettingsViewProps {
  const intl = useIntl();
  const { preference, setPreference } = useTheme();
  const { setLocale } = useAppLocale();
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loadState, setLoadState] = useState<SettingsLoadState>('loading');
  const [nameDraft, setNameDraft] = useState('');
  const [nameSave, setNameSave] = useState<SettingsSaveState>('idle');
  const [preferencesError, setPreferencesError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const loaded = (await apiClient.get<UserProfileDto>('/users/me')).data;
      setProfile(loaded);
      setNameDraft(loaded.displayName);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (nameSave !== 'saved') {
      return undefined;
    }
    const timer = setTimeout(() => {
      setNameSave('idle');
    }, SAVED_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [nameSave]);

  useEffect(() => {
    void readBiometrics(setBiometricAvailable, setBiometricEnabled);
  }, []);

  // Saves run one after another, so a slow earlier response can never overwrite a later one.
  function patchProfile(body: UpdateUserProfileDto): Promise<boolean> {
    const result = saveQueue.current.then(() => sendPatch(body));
    saveQueue.current = result;

    return result;
  }

  async function sendPatch(body: UpdateUserProfileDto): Promise<boolean> {
    try {
      const updated = (await apiClient.patch<UserProfileDto>('/users/me', body)).data;
      setProfile(updated);

      return true;
    } catch {
      return false;
    }
  }

  async function saveName(): Promise<void> {
    setNameSave('saving');
    const ok = await patchProfile({ displayName: nameDraft.trim() });
    setNameSave(ok ? 'saved' : 'error');
  }

  async function changeLocale(locale: SettingsLocale): Promise<void> {
    const ok = await patchProfile({ locale });
    setPreferencesError(!ok);
    if (ok) {
      setLocale(locale);
    }
  }

  async function changeCurrency(baseCurrency: SettingsCurrency): Promise<void> {
    setPreferencesError(!(await patchProfile({ baseCurrency })));
  }

  async function changeBiometric(enabled: boolean): Promise<void> {
    if (enabled) {
      const reason = intl.formatMessage({
        id: 'settings.biometric.reason',
        defaultMessage: 'Confirm to turn on biometric unlock',
      });
      if (!(await biometricUnlockService.authenticate(reason))) {
        return;
      }
    }
    await biometricUnlockService.setBiometricEnabled(enabled);
    setBiometricEnabled(enabled);
  }

  async function signOut(): Promise<void> {
    setSigningOut(true);
    try {
      await tokenStore.clearTokens();
    } finally {
      setSigningOut(false);
    }
  }

  return {
    loadState,
    email: profile?.email ?? '',
    nameDraft,
    nameSave,
    preference,
    locale: profile?.locale ?? 'en',
    baseCurrency: profile?.baseCurrency ?? null,
    preferencesError,
    biometricAvailable,
    biometricEnabled,
    signingOut,
    onRetry: () => {
      void load();
    },
    onNameChange: setNameDraft,
    onNameSave: () => {
      void saveName();
    },
    onPreferenceChange: setPreference,
    onLocaleChange: (locale) => {
      void changeLocale(locale);
    },
    onCurrencyChange: (currency) => {
      void changeCurrency(currency);
    },
    onBiometricChange: (enabled) => {
      void changeBiometric(enabled);
    },
    onSignOut: () => {
      void signOut();
    },
  };
}

async function readBiometrics(
  setAvailable: (available: boolean) => void,
  setEnabled: (enabled: boolean) => void,
): Promise<void> {
  try {
    setAvailable(await biometricUnlockService.canUseBiometrics());
    setEnabled(await biometricUnlockService.isBiometricEnabled());
  } catch {
    setAvailable(false);
  }
}
