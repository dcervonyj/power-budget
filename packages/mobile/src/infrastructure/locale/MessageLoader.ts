import en from '../../../assets/locales/en.json';
import pl from '../../../assets/locales/pl.json';
import ru from '../../../assets/locales/ru.json';
import uk from '../../../assets/locales/uk.json';
import type { SupportedLocale } from './LocaleResolver.js';

type Catalog = Record<string, string>;
export type FeatureMessageContext = {
  (path: string): Catalog;
  keys(): string[];
};

declare global {
  interface NodeRequire {
    context(directory: string, useSubdirectories: boolean, regExp: RegExp): FeatureMessageContext;
  }
}

const legacyMessagesByLocale: Record<SupportedLocale, Catalog> = { en, pl, ru, uk };
export const METRO_FEATURE_MESSAGES_DIRECTORY = '../../../assets/locales';
export const METRO_FEATURE_MESSAGES_PATTERN = /^\.\/[^/]+\/[^/]+\.json$/;
let getFeatureContext = getMetroFeatureContext;

export function setFeatureMessageContextForTests(context: FeatureMessageContext): void {
  getFeatureContext = (): FeatureMessageContext => context;
}

export async function loadMessages(locale: SupportedLocale): Promise<Catalog> {
  const featureContext = getFeatureContext();
  const featureMessages = featureContext
    .keys()
    .filter((path) => path.startsWith(`./${locale}/`))
    .sort()
    .map((path) => featureContext(path));

  return Object.assign({}, legacyMessagesByLocale[locale], ...featureMessages);
}

function getMetroFeatureContext(): FeatureMessageContext {
  return require.context(METRO_FEATURE_MESSAGES_DIRECTORY, true, METRO_FEATURE_MESSAGES_PATTERN);
}
