import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import type { LensData } from '@power-budget/shared-app';
import { Lens } from '../Lens.js';
import { renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const HIDDEN = { includeHiddenElements: true };
jest.mock('@shopify/react-native-skia', () => jest.requireActual('./skiaNamed.mock.js'));

const UNDER: LensData = {
  fraction: 4770 / 11800,
  amountLabel: '477',
  caption: '10 days left',
  ariaLabel: '477,00 zł a day, 10 days left',
  size: 'mobile',
};

describe('Lens', () => {
  it('is an image with the aria label and keeps the caption outside the glass', async () => {
    await renderLight(<Lens lens={UNDER} unitLabel="zł a day" />);
    const image = screen.getByRole('image', { name: UNDER.ariaLabel });

    expect(image).toBe(screen.getByTestId('lens-frame'));
    expect(screen.getByText('477')).toBeTruthy();
    expect(screen.getByText('zł a day')).toBeTruthy();
    expect(screen.getByText('10 days left')).toBeTruthy();
  });

  it('hides the Skia canvas from assistive tech', async () => {
    await renderLight(<Lens lens={UNDER} />);
    const canvas = screen.getByTestId('lens-frame').children[0];

    expect(canvas).toHaveProp('accessibilityElementsHidden', true);
    expect(canvas).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('puts the number in the upper 42 percent only', async () => {
    await renderLight(<Lens lens={UNDER} />);
    const style = StyleSheet.flatten(screen.getByTestId('lens-text').props.style);
    const frame = StyleSheet.flatten(screen.getByTestId('lens-frame').props.style);

    expect((style.top + style.height) / frame.height).toBeLessThanOrEqual(0.42 + 1e-9);
  });

  it('sizes the frame 220 and 120 (and 264 for the web hero size)', async () => {
    const sizes: number[] = [];
    for (const size of ['mobile', 'mini', 'hero'] as const) {
      const { unmount } = await renderLight(<Lens lens={{ ...UNDER, size }} />);
      sizes.push(StyleSheet.flatten(screen.getByTestId('lens-frame').props.style).width);
      await unmount();
    }

    expect(sizes).toEqual([220, 120, 264]);
  });

  it('draws core, caustics and sparks while there is money left', async () => {
    await renderLight(<Lens lens={UNDER} />);

    expect(screen.queryAllByTestId('skia-Path', HIDDEN)).toHaveLength(5);
    expect(screen.queryAllByTestId('skia-Circle', HIDDEN).length).toBeGreaterThan(5);
  });

  it('draws no core, caustics or sparks when f = 0', async () => {
    await renderLight(<Lens lens={{ ...UNDER, fraction: 0 }} />);

    expect(screen.queryAllByTestId('skia-Path', HIDDEN)).toHaveLength(2);
    expect(screen.queryAllByTestId('skia-Oval', HIDDEN)).toHaveLength(0);
    expect(screen.getByText('477')).toBeTruthy();
  });

  it('shows the full-intensity light at f = 1', async () => {
    await renderLight(<Lens lens={{ ...UNDER, fraction: 1 }} />);

    expect(screen.queryAllByTestId('skia-Path', HIDDEN)).toHaveLength(5);
    expect(screen.queryAllByTestId('skia-Oval', HIDDEN)).toHaveLength(1);
  });
});
