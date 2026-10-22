import { describe, expect, it } from 'vitest';
import { loadMessages } from '../MessageLoader.js';

describe('loadMessages', () => {
  it('merges legacy and feature messages for every supported locale', async () => {
    for (const locale of ['en', 'uk', 'ru', 'pl'] as const) {
      const messages = await loadMessages(locale);

      expect(messages['screen.dashboard.title']).toBeDefined();
      expect(messages['glass-fixture.message']).toBeDefined();
    }
  });
});
