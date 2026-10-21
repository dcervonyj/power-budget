import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Catalog = Record<string, string>;

const LOCALES = ['pl', 'uk', 'ru'] as const;
const CATALOG_DIRS = [
  resolve(__dirname, '../../public/locales'),
  resolve(__dirname, '../../../mobile/assets/locales'),
];

function load(dir: string, locale: string): Catalog {
  return JSON.parse(readFileSync(resolve(dir, `${locale}.json`), 'utf8')) as Catalog;
}

function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*(\w+)/g)].map((match) => match[1] ?? ''))].sort();
}

describe.each(CATALOG_DIRS)('locale catalogs in %s', (dir) => {
  const en = load(dir, 'en');

  describe.each(LOCALES)('%s', (locale) => {
    const catalog = load(dir, locale);

    it('has every key present in en', () => {
      const missing = Object.keys(en).filter((key) => !(key in catalog));

      expect(missing).toEqual([]);
    });

    it('has no keys absent from en', () => {
      const extra = Object.keys(catalog).filter((key) => !(key in en));

      expect(extra).toEqual([]);
    });

    it('has no empty messages', () => {
      const empty = Object.keys(catalog).filter((key) => catalog[key]?.trim() === '');

      expect(empty).toEqual([]);
    });

    it('keeps the same placeholders as en', () => {
      const mismatched = Object.keys(en).filter(
        (key) =>
          key in catalog &&
          JSON.stringify(placeholders(en[key] ?? '')) !==
            JSON.stringify(placeholders(catalog[key] ?? '')),
      );

      expect(mismatched).toEqual([]);
    });
  });
});
