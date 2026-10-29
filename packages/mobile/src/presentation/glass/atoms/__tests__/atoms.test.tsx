import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { glassDarkTheme } from '@power-budget/design-tokens/glass';
import { AmountText } from '../AmountText.js';
import { Avatar, AvatarPair, initialsOf } from '../Avatar.js';
import { Icon } from '../Icon.js';
import { ICON_NAMES, ICON_PATHS } from '../iconPaths.js';
import { StatusTag } from '../StatusTag.js';
import { deriveSyncChipState } from '../syncChipState.js';
import { toSupportedLocale } from '../supportedLocale.js';
import { LOCALES, plain, renderGlass } from './glassTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const MINUS = '−';

describe('Icon', () => {
  it('has a non-empty path for every name', () => {
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].length).toBeGreaterThan(0);
    }
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it('is hidden from assistive tech and sized', async () => {
    await renderGlass(<Icon name="check" size={18} color="#fff" />);
    const icon = screen.getByTestId('icon-check', { includeHiddenElements: true });

    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(icon.props.width).toBe(18);
    expect(screen.queryByTestId('icon-check')).toBeNull();
  });
});

describe('StatusTag', () => {
  it.each(['ok', 'over', 'neutral'] as const)('shows icon and words for %s', async (kind) => {
    await renderGlass(<StatusTag kind={kind} label="Words" />);

    expect(screen.getByText('Words')).toBeTruthy();
    expect(screen.getAllByTestId(/^icon-/, { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByLabelText('Words')).toBeTruthy();
  });

  it('uses the given icon', async () => {
    await renderGlass(<StatusTag kind="neutral" label="Locked" icon="lock" />);

    expect(screen.getByTestId('icon-lock', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('builds initials from the first two words', () => {
    expect(initialsOf('Anna Maria Kowalska')).toBe('AM');
    expect(initialsOf('  олена ')).toBe('О');
    expect(initialsOf('')).toBe('');
  });

  it('is an image named by the person', async () => {
    await renderGlass(<Avatar person={{ name: 'Anna Kowalska' }} />);

    expect(screen.getByRole('image', { name: 'Anna Kowalska' })).toBeTruthy();
  });

  it('shows one avatar without a partner and two with one', async () => {
    await renderGlass(<AvatarPair primary={{ name: 'Anna Kowalska' }} />);
    expect(screen.getAllByRole('image')).toHaveLength(1);

    await renderGlass(
      <AvatarPair primary={{ name: 'Anna Kowalska' }} secondary={{ name: 'Marek Nowak' }} />,
    );
    expect(screen.getByRole('image', { name: 'Marek Nowak' })).toBeTruthy();
  });
});

describe('AmountText', () => {
  it.each(LOCALES)('formats an exact amount in %s with a U+2212 minus', async (locale) => {
    await renderGlass(
      <AmountText amount={{ amountMinor: -123456n, currency: 'PLN' }} locale={locale} />,
    );
    const text = plain(textOf(screen.getByTestId('amount-text')));

    expect(text).toContain(MINUS);
    expect(text).not.toContain('-');
    expect(text).toMatch(/1.234[.,]56/);
  });

  it('dims only the currency part', async () => {
    await renderGlass(<AmountText amount={{ amountMinor: 1000n, currency: 'EUR' }} locale="en" />);
    const currency = screen.getByText('€');

    expect(StyleSheet.flatten(currency.props.style)?.color).toBe(glassDarkTheme.color.dim);
    expect(StyleSheet.flatten(screen.getByText('10').props.style)?.color).toBeUndefined();
  });

  it('shrinks the currency of an amount-size figure', async () => {
    await renderGlass(
      <AmountText amount={{ amountMinor: 1000n, currency: 'EUR' }} locale="en" size="amount" />,
    );

    expect(StyleSheet.flatten(screen.getByText('€').props.style)?.fontSize).toBe(15);
  });

  it('takes the locale from the intl context', async () => {
    await renderGlass(<AmountText amount={{ amountMinor: 123456n, currency: 'PLN' }} />, 'pl');

    expect(plain(textOf(screen.getByTestId('amount-text')))).toContain('1 234,56');
  });

  it('maps react-intl tags to supported locales', () => {
    expect(toSupportedLocale('pl-PL')).toBe('pl');
    expect(toSupportedLocale('de')).toBe('en');
  });
});

describe('deriveSyncChipState', () => {
  const NOW = new Date('2026-10-26T12:00:00Z');

  it('maps age to a chip state', () => {
    expect(deriveSyncChipState(null, NOW)).toEqual({ kind: 'stale' });
    expect(deriveSyncChipState(new Date('2026-10-26T11:59:30Z'), NOW)).toEqual({ kind: 'live' });
    expect(deriveSyncChipState(new Date('2026-10-26T11:00:00Z'), NOW)).toEqual({
      kind: 'bank-age',
      ageMinutes: 60,
    });
    expect(deriveSyncChipState(new Date('2026-10-25T11:00:00Z'), NOW)).toEqual({ kind: 'stale' });
  });
});

function textOf(element: ReactTestInstance): string {
  return element.children.map(childText).join('');
}

function childText(child: ReactTestInstance | string): string {
  return typeof child === 'string' ? child : textOf(child);
}
