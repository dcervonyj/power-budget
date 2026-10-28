import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadMessages } from '../AppProviders.js';
import {
  excludeFeatureMessages,
  findNeedsTranslation,
  splitNewMessages,
  mergeLegacyMessages,
  readFeatureMessageIds,
} from '../i18n/ExtractedMessageFilter.mjs';
import en from '../../public/locales/en.json';
import pl from '../../public/locales/pl.json';
import ru from '../../public/locales/ru.json';
import uk from '../../public/locales/uk.json';

const FIXTURE_FEATURE_KEY = 'glass-fixture.message';
const legacyMessages = { en, uk, ru, pl };
const featureMessages = import.meta.glob<Record<string, string>>('../../public/locales/*/*.json', {
  eager: true,
  import: 'default',
});

describe('loadMessages', () => {
  it('returns the flat message map, not the JSON module object', async () => {
    const messages = await loadMessages('pl');

    expect(messages).not.toHaveProperty('default');
    expect(messages['settings.title']).toBe(pl['settings.title']);
    expect(messages['settings.title']).toBe('Ustawienia');
  });

  it('loads every supported locale', async () => {
    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);
      const legacy = legacyMessages[locale];
      const featureKeyCount = Object.entries(featureMessages)
        .filter(([path]) => path.includes(`/locales/${locale}/`))
        .flatMap(([, catalog]) => Object.keys(catalog)).length;

      expect(Object.keys(messages)).toEqual(expect.arrayContaining(Object.keys(legacy)));
      expect(Object.keys(messages)).toHaveLength(Object.keys(legacy).length + featureKeyCount);
    }
    expect(Object.keys(en)).toHaveLength(462);
    expect((await loadMessages('en'))['screen.login.title']).toBe(en['screen.login.title']);
  });

  it('merges feature messages for every supported locale', async () => {
    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);

      expect(messages[FIXTURE_FEATURE_KEY]).toBeDefined();
    }
  });

  it('keeps legacy ids that share a feature prefix during extraction', () => {
    const extractedMessages = {
      'glass-fixture.message': 'Fixture message',
      'settings.profile.displayName': 'Display name',
    };
    const featureMessageIds = readFeatureMessageIds(resolve(process.cwd(), 'public/locales/en'));

    const legacyMessages = excludeFeatureMessages(extractedMessages, featureMessageIds);

    expect(legacyMessages).toEqual({ 'settings.profile.displayName': 'Display name' });
  });

  it('adds new extracted ids after the existing ones, sorted, and refreshes known text', () => {
    const merged = mergeLegacyMessages(
      { 'b.old': 'Old B', 'a.old': 'Old A' },
      { 'z.new': 'New Z', 'b.old': 'Fresh B', 'c.new': 'New C' },
    );

    expect(Object.entries(merged)).toEqual([
      ['b.old', 'Fresh B'],
      ['a.old', 'Old A'],
      ['c.new', 'New C'],
      ['z.new', 'New Z'],
    ]);
  });

  it('lists the English ids each translated locale still lacks', () => {
    const needsTranslation = findNeedsTranslation(
      { 'a.one': 'One', 'a.two': 'Two' },
      { pl: { 'a.one': 'Jeden', 'a.two': 'Dwa' }, uk: { 'a.one': 'Один' }, ru: {} },
    );

    expect(needsTranslation).toEqual({
      pl: {},
      uk: { 'a.two': 'Two' },
      ru: { 'a.one': 'One', 'a.two': 'Two' },
    });
  });

  it('routes new ids into the feature catalog named by their first segment', () => {
    const { legacy, features } = splitNewMessages(
      { 'tx.row.choose': 'Choose', 'bulk.clear': 'Clear', 'tx.list.over': 'Over' },
      ['tx.json', 'banks.json'],
    );

    expect(legacy).toEqual({ 'bulk.clear': 'Clear' });
    expect(features).toEqual({ 'tx.json': { 'tx.row.choose': 'Choose', 'tx.list.over': 'Over' } });
  });
});
