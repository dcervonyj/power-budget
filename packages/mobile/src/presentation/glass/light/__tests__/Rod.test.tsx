import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import type { RodData } from '@power-budget/shared-app';
import { Rod, RodLight } from '../Rod.js';
import { glassLightRn, renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@shopify/react-native-skia', () => jest.requireActual('./skiaNamed.mock.js'));

const UNDER: RodData = {
  fraction: 0.404,
  paceProgress: 0.71,
  state: 'under',
  ariaLabel: 'Groceries: 1 051,36 zł left of 2 200,00 zł',
  size: 'pace',
};

function lightOf(rod: RodData): React.JSX.Element {
  return <RodLight glass={glassLightRn} rod={rod} index={0} width={300} height={14} />;
}

function count(name: string): number {
  return screen.queryAllByTestId(`skia-${name}`).length;
}

describe('Rod', () => {
  it('is an image with the aria label and no tag while under', async () => {
    await renderLight(<Rod rod={UNDER} />);

    expect(screen.getByRole('image', { name: UNDER.ariaLabel })).toBe(screen.getByTestId('rod'));
    expect(screen.queryByTestId('rod-tag')).toBeNull();
  });

  it('puts the pace mark at month-left and sizes the rods 14 and 10', async () => {
    const { unmount } = await renderLight(<Rod rod={UNDER} />);

    expect(StyleSheet.flatten(screen.getByTestId('rod-pace').props.style).left).toBe('29%');
    expect(StyleSheet.flatten(screen.getByTestId('rod-track').props.style).height).toBe(14);
    await unmount();
    await renderLight(<Rod rod={{ ...UNDER, size: 'category', paceProgress: undefined }} />);

    expect(StyleSheet.flatten(screen.getByTestId('rod-track').props.style).height).toBe(10);
    expect(screen.queryByTestId('rod-pace')).toBeNull();
  });

  it('shows the translated Over budget tag when over', async () => {
    await renderLight(<Rod rod={{ ...UNDER, state: 'over', fraction: 0 }} />, 'pl');

    expect(screen.getByText('Przekroczony budżet')).toBeTruthy();
  });

  it('draws the hatch and no beam when over', async () => {
    await renderLight(lightOf({ ...UNDER, state: 'over', fraction: 0 }));

    expect(count('Path')).toBe(1);
    expect(count('RoundedRect')).toBe(0);
  });

  it('shows the Paid tag with no light when paid', async () => {
    await renderLight(<Rod rod={{ ...UNDER, state: 'paid', fraction: 0 }} />);

    expect(screen.getByText('Paid')).toBeTruthy();
    expect(count('RoundedRect')).toBe(0);
    expect(count('Path')).toBe(0);
  });

  it('uses a custom tag label when given', async () => {
    await renderLight(<Rod rod={{ ...UNDER, state: 'over' }} tagLabel="Over by 62,50 zł" />);

    expect(screen.getByText('Over by 62,50 zł')).toBeTruthy();
  });

  it('draws the beam while under', async () => {
    await renderLight(lightOf(UNDER));

    expect(count('RoundedRect')).toBe(3);
  });

  it('draws nothing when empty', async () => {
    await renderLight(lightOf({ ...UNDER, state: 'empty', fraction: 0 }));

    expect(count('RoundedRect')).toBe(0);
    expect(count('Path')).toBe(0);
  });
});
