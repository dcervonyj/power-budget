import enGlassFixture from '../../../assets/locales/en/glass-fixture.json';
import plGlassFixture from '../../../assets/locales/pl/glass-fixture.json';
import ruGlassFixture from '../../../assets/locales/ru/glass-fixture.json';
import ukGlassFixture from '../../../assets/locales/uk/glass-fixture.json';
import type { SupportedLocale } from './LocaleResolver.js';

type Catalog = Record<string, string>;

export const featureMessagesByLocale: Record<SupportedLocale, readonly Catalog[]> = {
  en: [enGlassFixture],
  pl: [plGlassFixture],
  ru: [ruGlassFixture],
  uk: [ukGlassFixture],
};
