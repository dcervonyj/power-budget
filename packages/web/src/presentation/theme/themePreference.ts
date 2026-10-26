export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'pb_theme';
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function parseThemePreference(value: string | null): ThemePreference {
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value;
  }

  return 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
}

export function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode); the preference then lasts for the session only.
  }
}

/** Mirrors `public/theme-boot.js`, which sets the same attributes before first paint. */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
}
