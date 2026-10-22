import en from '../../../assets/locales/en.json';
import pl from '../../../assets/locales/pl.json';
import ru from '../../../assets/locales/ru.json';
import uk from '../../../assets/locales/uk.json';
import { featureMessagesByLocale } from './featureMessages.js';
import type { SupportedLocale } from './LocaleResolver.js';

type Catalog = Record<string, string>;

const legacyMessagesByLocale: Record<SupportedLocale, Catalog> = { en, pl, ru, uk };

export async function loadMessages(locale: SupportedLocale): Promise<Catalog> {
  return Object.assign({}, legacyMessagesByLocale[locale], ...featureMessagesByLocale[locale]);
}
