import React from 'react';

type CrashLocale = 'en' | 'uk' | 'ru' | 'pl';

interface CrashText {
  message: string;
  reload: string;
}

// Static on purpose: this fallback renders outside AppProviders, when locale chunks may be the
// very thing that failed, so it cannot use react-intl or import a chunk.
const CRASH_TEXT: Record<CrashLocale, CrashText> = {
  en: { message: 'Something went wrong.', reload: 'Reload' },
  uk: { message: 'Щось пішло не так.', reload: 'Перезавантажити' },
  ru: { message: 'Что-то пошло не так.', reload: 'Перезагрузить' },
  pl: { message: 'Coś poszło nie tak.', reload: 'Załaduj ponownie' },
};

export function pickCrashLocale(stored: string | null, browser: string): CrashLocale {
  for (const candidate of [stored, browser.split('-')[0]]) {
    if (candidate !== null && candidate !== undefined && candidate in CRASH_TEXT) {
      return candidate as CrashLocale;
    }
  }

  return 'en';
}

function storedLocale(): string | null {
  try {
    return localStorage.getItem('pb_locale');
  } catch {
    return null;
  }
}

function reloadPage(): void {
  window.location.reload();
}

/** Last-resort fallback outside AppProviders: no intl, no chunk imports. */
export function StaticCrashFallback(): React.JSX.Element {
  const text = CRASH_TEXT[pickCrashLocale(storedLocale(), navigator.language)];

  return (
    <div role="alert" style={{ padding: 'var(--pb-glass-space-lg)' }}>
      <p>{text.message}</p>
      <button type="button" onClick={reloadPage}>
        {text.reload}
      </button>
    </div>
  );
}
