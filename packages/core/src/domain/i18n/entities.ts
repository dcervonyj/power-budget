import type { LocaleCode } from '../shared/locale.js';

export interface Locale {
  readonly code: LocaleCode;
  readonly displayName: string;
  readonly nativeName: string;
}
