import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { SyncChip } from '../SyncChip.js';
import { deriveSyncChipState, type SyncChipState } from '../syncChipState.js';

function renderChip(
  state: SyncChipState,
  viewer?: 'owner' | 'partner',
  onPress?: () => void,
): HTMLElement {
  const { container } = render(
    <IntlProvider locale="en" messages={{}} onError={() => undefined}>
      <SyncChip state={state} viewer={viewer} onPress={onPress} />
    </IntlProvider>,
  );

  return container;
}

describe('SyncChip text', () => {
  it.each([
    [{ kind: 'live' }, 'owner', 'Live'],
    [{ kind: 'bank-age', ageMinutes: 1 }, 'owner', 'Your bank updated 1 minute ago'],
    [{ kind: 'bank-age', ageMinutes: 25 }, 'owner', 'Your bank updated 25 minutes ago'],
    [{ kind: 'bank-age', ageMinutes: 300 }, 'owner', 'Your bank updated 5 hours ago'],
    [{ kind: 'bank-age', ageMinutes: 2 * 24 * 60 }, 'owner', 'Your bank updated 2 days ago'],
    [{ kind: 'bank-age', ageMinutes: 25 }, 'partner', "Partner's bank updated 25 minutes ago"],
    [{ kind: 'updating' }, 'owner', 'Updating…'],
    [{ kind: 'renew' }, 'owner', 'Renew bank access'],
    [{ kind: 'renew' }, 'partner', "Partner's bank access needs renewing"],
    [{ kind: 'stale' }, 'owner', 'Bank data is out of date'],
    [{ kind: 'stale' }, 'partner', "Partner's bank data is out of date"],
    [{ kind: 'cooldown', minutesLeft: 1 }, 'owner', 'Refresh available in 1 minute'],
    [{ kind: 'cooldown', minutesLeft: 4 }, 'partner', 'Refresh available in 4 minutes'],
  ] satisfies [SyncChipState, 'owner' | 'partner', string][])(
    'renders %j for %s',
    (state, viewer, text) => {
      const container = renderChip(state, viewer);

      expect(container.textContent).toBe(text);
      expect(
        container.querySelector('svg[aria-hidden="true"], span[aria-hidden="true"]'),
      ).not.toBeNull();
    },
  );

  it('is a button only when pressable', () => {
    const onPress = vi.fn();
    const plain = renderChip({ kind: 'live' });

    expect(plain.querySelector('button')).toBeNull();

    renderChip({ kind: 'renew' }, 'owner', onPress);
    fireEvent.click(screen.getByRole('button', { name: 'Renew bank access' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('deriveSyncChipState', () => {
  const now = new Date('2026-10-22T13:00:00Z');

  it.each([
    [null, { kind: 'stale' }],
    [new Date('2026-10-22T12:59:30Z'), { kind: 'live' }],
    [new Date('2026-10-22T12:35:00Z'), { kind: 'bank-age', ageMinutes: 25 }],
    [new Date('2026-10-21T13:00:00Z'), { kind: 'stale' }],
    [new Date('2026-10-23T13:00:00Z'), { kind: 'live' }],
  ] satisfies [Date | null, SyncChipState][])('maps %s', (last, expected) => {
    expect(deriveSyncChipState(last, now)).toEqual(expected);
  });
});
