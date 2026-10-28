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

const BRANCHING_ARGUMENT = /^\s*(\w+)\s*,\s*(?:plural|select|selectordinal)\s*,(.*)$/s;
const PLAIN_ARGUMENT = /^\s*(\w+)\s*(?:,|$)/;

// Contents of the top-level {...} groups of a message, braces stripped.
function topLevelGroups(
  text: string,
  index = 0,
  depth = 0,
  start = 0,
  groups: string[] = [],
): string[] {
  if (index >= text.length) {
    return groups;
  }
  const char = text[index];
  const opens = char === '{';
  const closes = char === '}' && depth > 0;
  const closesGroup = closes && depth === 1;

  return topLevelGroups(
    text,
    index + 1,
    depth + (opens ? 1 : 0) - (closes ? 1 : 0),
    opens && depth === 0 ? index + 1 : start,
    closesGroup ? [...groups, text.slice(start, index)] : groups,
  );
}

// Argument names of an ICU message. Plural/select branch bodies are scanned for nested
// arguments only; their text (in any script) is never mistaken for an argument.
function collectPlaceholders(message: string): string[] {
  return topLevelGroups(message).flatMap((group) => {
    const branching = BRANCHING_ARGUMENT.exec(group);

    if (branching) {
      return [
        branching[1] || '',
        ...topLevelGroups(branching[2] || '').flatMap(collectPlaceholders),
      ];
    }

    return [PLAIN_ARGUMENT.exec(group)?.[1] || ''].filter(Boolean);
  });
}

function placeholders(message: string): string[] {
  return [...new Set(collectPlaceholders(message))].sort();
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

describe('placeholders', () => {
  it('ignores one-word ASCII plural branches', () => {
    expect(placeholders('{count, plural, one {item} other {items}}')).toEqual(['count']);
  });

  it('ignores one-word Polish and Cyrillic branches', () => {
    expect(placeholders('{count, plural, one {Wybrano} few {Вибрано} other {Выбрано #}}')).toEqual([
      'count',
    ]);
  });

  it('ignores select branches but finds arguments nested in them', () => {
    expect(placeholders('{kind, select, income {Income} other {Spent {amount}}}')).toEqual([
      'amount',
      'kind',
    ]);
  });

  it('finds plain arguments', () => {
    expect(placeholders('Map {count} for {name}, {n, number}')).toEqual(['count', 'n', 'name']);
  });
});
