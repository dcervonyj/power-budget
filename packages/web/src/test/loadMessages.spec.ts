import { describe, expect, it } from 'vitest';
import { loadMessages } from '../AppProviders.js';
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
