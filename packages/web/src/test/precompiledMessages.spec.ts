import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIntl } from 'react-intl';
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { compileMessages } from '../i18n/precompiledMessages.js';

const LOCALES_DIR = resolve(__dirname, '../../public/locales');

function readLocale(locale: string): Record<string, string> {
  const files = [
    `${locale}.json`,
    ...readdirSync(resolve(LOCALES_DIR, locale)).map((f) => `${locale}/${f}`),
  ];

  return Object.assign(
    {},
    ...files.map((file) => JSON.parse(readFileSync(resolve(LOCALES_DIR, file), 'utf8'))),
  );
}

/** Gives every argument of the message the same number: it drives plural, and select falls back to `other`. */
function valuesFor(message: string, value: number): Record<string, number> {
  const names = [...message.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1] ?? '');

  return Object.fromEntries(names.map((name) => [name, value]));
}

function formatBoth(
  message: string,
  locale: string,
  values: Record<string, unknown>,
): [string, string] {
  const raw = createIntl({ locale, messages: { m: message } });
  const compiled = createIntl({
    locale,
    messages: compileMessages({ m: message }, `${locale}.json`) as Record<
      string,
      MessageFormatElement[]
    >,
  });

  return [
    raw.formatMessage({ id: 'm' }, values as never),
    compiled.formatMessage({ id: 'm' }, values as never),
  ];
}

describe('compileMessages', () => {
  it('rejects a message that is not a string', () => {
    expect(() => compileMessages({ 'nested.id': { a: 'b' } }, 'en.json')).toThrow(
      /nested\.id.*string/,
    );
  });

  it('precompiles a plural message that react-intl formats from the AST', () => {
    const source = { 'a.b': 'Refresh in {minutes, plural, one {# minute} other {# minutes}}' };
    const compiled = compileMessages(source, 'en.json');
    const intl = createIntl({
      locale: 'en',
      messages: compiled as Record<string, MessageFormatElement[]>,
    });

    expect(intl.formatMessage({ id: 'a.b' }, { minutes: 1 })).toBe('Refresh in 1 minute');
    expect(intl.formatMessage({ id: 'a.b' }, { minutes: 5 })).toBe('Refresh in 5 minutes');
  });

  it('fails on an invalid ICU message and names the id', () => {
    expect(() => compileMessages({ 'bad.id': 'Oops {unclosed' }, 'en.json')).toThrow(/bad\.id/);
  });

  it.each(['en', 'uk', 'ru', 'pl'])('compiles every message of the %s locale', (locale) => {
    const messages = readLocale(locale);

    expect(Object.keys(compileMessages(messages, `${locale}.json`))).toEqual(Object.keys(messages));
  });

  it.each(['en', 'uk', 'ru', 'pl'])(
    'renders %s plural and select messages the same compiled and raw',
    (locale) => {
      const sampled = Object.entries(readLocale(locale))
        .filter(([, message]) => /\{\w+, (plural|select|selectordinal),/.test(message))
        .slice(0, 5);

      expect(sampled.length).toBeGreaterThan(0);
      for (const [, message] of sampled) {
        for (const count of [1, 2, 5, 21]) {
          const [raw, compiled] = formatBoth(message, locale, valuesFor(message, count));

          expect(compiled).toBe(raw);
        }
      }
    },
  );
});
