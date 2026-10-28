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

describe('compileMessages', () => {
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
});
