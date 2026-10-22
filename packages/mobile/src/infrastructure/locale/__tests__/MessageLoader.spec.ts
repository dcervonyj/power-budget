import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadMessages,
  setFeatureMessageContextForTests,
  type FeatureMessageContext,
} from '../MessageLoader.js';

type Catalog = Record<string, string>;

const ASSETS_DIRECTORY = resolve(__dirname, '../../../../assets/locales');

function createFeatureContext(): FeatureMessageContext {
  const catalogs = new Map<string, Catalog>();

  for (const locale of ['en', 'uk', 'ru', 'pl']) {
    const featureDirectory = resolve(ASSETS_DIRECTORY, locale);

    for (const fileName of readdirSync(featureDirectory).filter((name) => name.endsWith('.json'))) {
      const path = `./${locale}/${fileName}`;
      catalogs.set(path, JSON.parse(readFileSync(resolve(featureDirectory, fileName), 'utf8')));
    }
  }

  const getCatalog = (path: string): Catalog => {
    const catalog = catalogs.get(path);
    if (!catalog) {
      throw new Error(`Unknown feature catalog: ${path}`);
    }

    return catalog;
  };

  return Object.assign(getCatalog, { keys: (): string[] => [...catalogs.keys()] });
}

function stubMetroRequire(): void {
  setFeatureMessageContextForTests(createFeatureContext());
}

describe('loadMessages', () => {
  it('merges legacy and feature messages for every supported locale', async () => {
    stubMetroRequire();

    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);

      expect(messages['screen.dashboard.title']).toBeDefined();
      expect(messages['glass-fixture.message']).toBeDefined();
    }
  });

  it('loads every key from every feature catalog', async () => {
    stubMetroRequire();

    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);
      const featureDirectory = resolve(ASSETS_DIRECTORY, locale);

      for (const fileName of readdirSync(featureDirectory).filter((name) =>
        name.endsWith('.json'),
      )) {
        const featureMessages: Catalog = JSON.parse(
          readFileSync(resolve(featureDirectory, fileName), 'utf8'),
        );

        for (const key of Object.keys(featureMessages)) {
          expect(messages[key]).toBe(featureMessages[key]);
        }
      }
    }
  });
});
