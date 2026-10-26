import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { Tube } from '../Tube.js';
import { renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@shopify/react-native-skia', () => jest.requireActual('./skiaNamed.mock.js'));

async function renderTube(fraction: number): Promise<void> {
  await renderLight(<Tube tube={{ fraction, ariaLabel: 'tube' }} />);
  await fireEvent(screen.getByTestId('tube'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 18, height: 160 } },
  });
}

describe('Tube', () => {
  it('is an image with the aria label, 18 wide', async () => {
    await renderLight(
      <Tube tube={{ fraction: 0.7, ariaLabel: 'Lisbon: 6340,00 zł of 9000,00 zł' }} />,
    );
    const tube = screen.getByRole('image', { name: 'Lisbon: 6340,00 zł of 9000,00 zł' });

    expect(StyleSheet.flatten(tube.props.style).width).toBe(18);
    expect(StyleSheet.flatten(tube.props.style).height).toBe(160);
  });

  it('draws the rising light when there is a fraction', async () => {
    await renderTube(0.7);

    expect(
      screen.queryAllByTestId('skia-RoundedRect', { includeHiddenElements: true }),
    ).toHaveLength(3);
  });

  it('draws no light at fraction 0', async () => {
    await renderTube(0);

    expect(
      screen.queryAllByTestId('skia-RoundedRect', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });
});
