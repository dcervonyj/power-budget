import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';
import { Tube, TubeBeam } from '../Tube.js';
import { glassLightRn, renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@shopify/react-native-skia', () => jest.requireActual('./skiaNamed.mock.js'));

describe('Tube', () => {
  it('is an image with the aria label, 18 wide', async () => {
    await renderLight(
      <Tube tube={{ fraction: 0.7, ariaLabel: 'Lisbon: 6340,00 zł of 9000,00 zł' }} />,
    );
    const tube = screen.getByRole('image', { name: 'Lisbon: 6340,00 zł of 9000,00 zł' });

    expect(StyleSheet.flatten(tube.props.style).width).toBe(18);
    expect(StyleSheet.flatten(tube.props.style).height).toBe(160);
  });

  it('draws the rising light by the fraction', async () => {
    await renderLight(
      <TubeBeam glass={glassLightRn} fraction={0.7} index={0} width={18} height={160} />,
    );

    expect(screen.queryAllByTestId('skia-RoundedRect')).toHaveLength(3);
  });
});
