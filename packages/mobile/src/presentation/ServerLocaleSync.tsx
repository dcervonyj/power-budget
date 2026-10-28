import { useEffect } from 'react';
import type { UserProfileDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../infrastructure/index.js';
import { useAppLocale } from './LocaleProvider.js';

/**
 * Applies the profile language as soon as the user is authenticated (sign-in or session restore),
 * so a language chosen on another device is used before Settings is ever opened.
 */
export function ServerLocaleSync({ authenticated }: { authenticated: boolean }): null {
  const { setLocale } = useAppLocale();

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    void syncServerLocale(setLocale);
  }, [authenticated, setLocale]);

  return null;
}

async function syncServerLocale(
  setLocale: ReturnType<typeof useAppLocale>['setLocale'],
): Promise<void> {
  const sessionId = apiClient.sessionId;
  try {
    const profile = (await apiClient.get<UserProfileDto>('/users/me')).data;
    setLocale(profile.locale, 'server', sessionId);
  } catch {
    // The device language stays; Settings loads the profile again and shows its own error.
  }
}
