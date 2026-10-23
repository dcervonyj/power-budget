import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadMessages,
  METRO_FEATURE_MESSAGES_DIRECTORY,
  METRO_FEATURE_MESSAGES_PATTERN,
  setFeatureMessageContextForTests,
  type FeatureMessageContext,
} from '../MessageLoader.js';
import { excludeFeatureMessages, readFeatureMessageIds } from '../ExtractedMessageFilter.mjs';

type Catalog = Record<string, string>;

const ASSETS_DIRECTORY = resolve(__dirname, '../../../../assets/locales');
const MESSAGE_LOADER_SOURCE_PATH = resolve(__dirname, '../MessageLoader.ts');

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
  it('uses a Metro context pattern for locale feature catalogs', () => {
    expect(METRO_FEATURE_MESSAGES_DIRECTORY).toBe('../../../assets/locales');
    expect(METRO_FEATURE_MESSAGES_PATTERN.test('./pl/glass-fixture.json')).toBe(true);
    expect(METRO_FEATURE_MESSAGES_PATTERN.test('./pl.json')).toBe(false);
  });

  it('passes literal arguments to Metro require.context', () => {
    const source = readFileSync(MESSAGE_LOADER_SOURCE_PATH, 'utf8');
    const literalPattern = /^\.\/[^/]+\/[^/]+\.json$/;

    expect(source).toMatch(
      /require\.context\(\s*'\.\.\/\.\.\/\.\.\/assets\/locales'\s*,\s*true\s*,\s*\/\^\\\.\\\/\[\^\/\]\+\\\/\[\^\/\]\+\\\.json\$\/\s*\)/,
    );
    expect(literalPattern.test('./pl/glass-fixture.json')).toBe(true);
    expect(literalPattern.test('./pl.json')).toBe(false);
  });

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

  it('keeps legacy ids that share a feature prefix during extraction', () => {
    const extractedMessages = {
      'glass-fixture.message': 'Fixture message',
      'settings.profile.displayName': 'Display name',
    };
    const featureMessageIds = readFeatureMessageIds(resolve(ASSETS_DIRECTORY, 'en'));

    const legacyMessages = excludeFeatureMessages(extractedMessages, featureMessageIds);

    expect(legacyMessages).toEqual({ 'settings.profile.displayName': 'Display name' });
  });
});
