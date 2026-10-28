import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIntl, defineMessages, IntlProvider } from 'react-intl';
import { SyncChip } from '../presentation/glass/atoms/SyncChip.js';
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

  it.each([
    ['owner' as const, 'Your bank updated 25 minutes ago'],
    ['partner' as const, "Partner's bank updated 5 hours ago"],
  ])(
    'renders the %s bank-age chip as text, not as raw ICU (CLN-074d visual regression)',
    (viewer, copy) => {
      const ageMinutes = viewer === 'owner' ? 25 : 300;
      const html = renderToStaticMarkup(
        <IntlProvider locale="en" messages={{}}>
          <SyncChip state={{ kind: 'bank-age', ageMinutes }} viewer={viewer} />
        </IntlProvider>,
      );

      expect(html.replaceAll('&#x27;', "'")).toContain(copy);
    },
  );
});
