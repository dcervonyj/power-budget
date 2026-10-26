export type ThemePreference = 'system' | 'dark' | 'light';

export type ResolvedThemeName = 'dark' | 'light';

export const THEME_PREFERENCE_STORAGE_KEY = 'power-budget.theme-preference';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ResolvedThemeName {
  if (preference === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }

  return preference;
}
