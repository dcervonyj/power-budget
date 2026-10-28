import { describe, expect, it } from 'vitest';
import { createIntl, defineMessages } from 'react-intl';
import enShell from '../../public/locales/en/glass-atoms.json';

// Run by vitest.noparser.config.ts: the ICU parser is aliased to its no-parser build, as in production.
const MESSAGES = defineMessages({
  items: {
    id: 'noparser.items',
    defaultMessage: '{count, plural, one {# item} other {# items}} for {who}',
  },
});

describe('formatting without the ICU parser', () => {
  it('formats a precompiled locale message', () => {
    const intl = createIntl({
      locale: 'en',
      messages: enShell,
    });

    expect(intl.formatMessage({ id: 'glass-atoms.sync.cooldown' }, { minutes: 1 })).toBe(
      'Refresh available in 1 minute',
    );
    expect(intl.formatMessage({ id: 'glass-atoms.sync.cooldown' }, { minutes: 3 })).toBe(
      'Refresh available in 3 minutes',
    );
  });

  it('formats a defaultMessage that babel-plugin-formatjs rewrote to an AST', () => {
    const intl = createIntl({ locale: 'en', messages: {} });

    expect(intl.formatMessage(MESSAGES.items, { count: 2, who: 'Ann' })).toBe('2 items for Ann');
  });

  it('proves the parser is gone: a raw ICU string with values cannot be formatted', () => {
    const intl = createIntl({
      locale: 'en',
      messages: { raw: 'Hello {name}' },
      onError: () => undefined,
    });

    expect(intl.formatMessage({ id: 'raw' }, { name: 'Ann' })).not.toBe('Hello Ann');
  });
});
