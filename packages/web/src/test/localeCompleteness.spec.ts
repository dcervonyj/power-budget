import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Catalog = Record<string, string>;
type Locale = 'en' | 'pl' | 'uk' | 'ru';
type LocalizedCatalogs = Record<Locale, Catalog>;

const LOCALES: readonly Locale[] = ['en', 'pl', 'uk', 'ru'];
const CATALOG_DIRS = [
  resolve(__dirname, '../../public/locales'),
  resolve(__dirname, '../../../mobile/assets/locales'),
];

function load(path: string): Catalog {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*(\w+)/g)].map((match) => match[1] || ''))].sort();
}

function assertCatalogsMatch(feature: string, catalogs: LocalizedCatalogs): void {
  const en = catalogs.en;

  for (const locale of LOCALES.filter((locale) => locale !== 'en')) {
    const catalog = catalogs[locale];
    const missing = Object.keys(en).filter((key) => !(key in catalog));
    const extra = Object.keys(catalog).filter((key) => !(key in en));
    const empty = Object.keys(catalog).filter((key) => catalog[key]?.trim() === '');
    const mismatchedPlaceholders = Object.keys(en).filter(
      (key) =>
        key in catalog &&
        JSON.stringify(placeholders(en[key] || '')) !==
          JSON.stringify(placeholders(catalog[key] || '')),
    );

    expect(missing, `${feature}: ${locale} missing keys`).toEqual([]);
    expect(extra, `${feature}: ${locale} extra keys`).toEqual([]);
    expect(empty, `${feature}: ${locale} empty messages`).toEqual([]);
    expect(mismatchedPlaceholders, `${feature}: ${locale} placeholder mismatch`).toEqual([]);
  }
}

function loadLocalizedCatalogs(directory: string, fileName: string): LocalizedCatalogs {
  return {
    en: load(resolve(directory, 'en', fileName)),
    pl: load(resolve(directory, 'pl', fileName)),
    uk: load(resolve(directory, 'uk', fileName)),
    ru: load(resolve(directory, 'ru', fileName)),
  };
}

describe.each(CATALOG_DIRS)('locale catalogs in %s', (directory) => {
  it('keeps legacy catalogs aligned', () => {
    const catalogs: LocalizedCatalogs = {
      en: load(resolve(directory, 'en.json')),
      pl: load(resolve(directory, 'pl.json')),
      uk: load(resolve(directory, 'uk.json')),
      ru: load(resolve(directory, 'ru.json')),
    };

    assertCatalogsMatch('legacy', catalogs);
  });

  it('keeps every feature catalog aligned independently', () => {
    const featureNames = readdirSync(resolve(directory, 'en'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();

    for (const locale of LOCALES.filter((locale) => locale !== 'en')) {
      const localeFeatures = readdirSync(resolve(directory, locale), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name)
        .sort();

      expect(localeFeatures, `${locale} feature file names`).toEqual(featureNames);
    }

    for (const featureName of featureNames) {
      assertCatalogsMatch(featureName, loadLocalizedCatalogs(directory, featureName));
    }
  });

  it('fails validation when a feature is missing a Polish key', () => {
    expect(() =>
      assertCatalogsMatch('glass-fixture', {
        en: { 'glass-fixture.message': 'Fixture' },
        pl: {},
        uk: { 'glass-fixture.message': 'Fixture' },
        ru: { 'glass-fixture.message': 'Fixture' },
      }),
    ).toThrow();
  });
});
