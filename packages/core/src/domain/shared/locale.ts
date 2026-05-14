export type LocaleCode = 'en' | 'uk' | 'ru' | 'pl';

export const SUPPORTED_LOCALES = ['en', 'uk', 'ru', 'pl'] as const satisfies readonly LocaleCode[];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export function isSupportedLocale(s: string): s is LocaleCode {
  return (SUPPORTED_LOCALES as readonly string[]).includes(s);
}
