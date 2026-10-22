import { describe, expect, it } from 'vitest';
import { loadMessages } from '../AppProviders.js';
import en from '../../public/locales/en.json';
import pl from '../../public/locales/pl.json';

const FIXTURE_FEATURE_KEY = 'glass-fixture.message';

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

      expect(Object.keys(messages)).toHaveLength(424);
    }
    expect(Object.keys(en)).toHaveLength(423);
    expect((await loadMessages('en'))['screen.login.title']).toBe(en['screen.login.title']);
  });

  it('merges feature messages for every supported locale', async () => {
    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);

      expect(messages[FIXTURE_FEATURE_KEY]).toBeDefined();
    }
  });
});
