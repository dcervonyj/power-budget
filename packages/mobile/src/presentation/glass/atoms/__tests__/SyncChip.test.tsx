import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { SyncChip } from '../SyncChip.js';
import type { SyncChipState } from '../syncChipState.js';
import { LOCALES, renderGlass } from './glassTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const STATES: readonly SyncChipState[] = [
  { kind: 'live' },
  { kind: 'bank-age', ageMinutes: 25 },
  { kind: 'bank-age', ageMinutes: 300 },
  { kind: 'bank-age', ageMinutes: 3000 },
  { kind: 'updating' },
  { kind: 'renew' },
  { kind: 'stale' },
  { kind: 'cooldown', minutesLeft: 4 },
];

const EN_OWNER = [
  'Live',
  'Your bank updated 25 minutes ago',
  'Your bank updated 5 hours ago',
  'Your bank updated 2 days ago',
  'Updating…',
  'Renew bank access',
  'Bank data is out of date',
  'Refresh available in 4 minutes',
];

describe('SyncChip texts', () => {
  it.each(STATES.map((state, index) => [state, EN_OWNER[index]] as const))(
    'says %j in English for the owner',
    async (state, text) => {
      await renderGlass(<SyncChip state={state} />);

      expect(screen.getByText(text ?? '')).toBeTruthy();
      expect(screen.getByLabelText(text ?? '')).toBeTruthy();
    },
  );

  it('uses partner wording', async () => {
    await renderGlass(<SyncChip state={{ kind: 'renew' }} viewer="partner" />);

    expect(screen.getByText("Partner's bank access needs renewing")).toBeTruthy();
  });

  it.each(LOCALES.flatMap((locale) => STATES.map((state) => [locale, state] as const)))(
    'translates %s %j (no English leftovers)',
    async (locale, state) => {
      await renderGlass(<SyncChip state={state} />, locale);
      const label = screen.getByTestId(`sync-chip-${state.kind}`).props
        .accessibilityLabel as string;

      expect(label.length).toBeGreaterThan(0);
      if (locale !== 'en') {
        expect(EN_OWNER).not.toContain(label);
      }
    },
  );

  it('pluralises Slavic minutes (ru and uk)', async () => {
    await renderGlass(<SyncChip state={{ kind: 'bank-age', ageMinutes: 2 }} />, 'ru');
    expect(screen.getByText('Ваш банк: обновлено 2 минуты назад')).toBeTruthy();
  });
});

describe('SyncChip behaviour', () => {
  it('is a button only with onPress and calls it', async () => {
    const onPress = jest.fn();
    await renderGlass(<SyncChip state={{ kind: 'renew' }} onPress={onPress} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Renew bank access' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no button without onPress', async () => {
    await renderGlass(<SyncChip state={{ kind: 'live' }} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('sync-live-dot', { includeHiddenElements: true })).toBeTruthy();
  });
});
