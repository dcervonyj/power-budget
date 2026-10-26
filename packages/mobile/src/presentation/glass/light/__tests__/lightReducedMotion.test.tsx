import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { screen } from '@testing-library/react-native';
import type { LensData } from '@power-budget/shared-app';
import { Lens } from '../Lens.js';
import { RodLight } from '../Rod.js';
import { TubeBeam } from '../Tube.js';
import { glassLightRn, lightProviders, renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockReduced = false;
const mockRepeat = jest.fn();
const mockTiming = jest.fn();

jest.mock('@shopify/react-native-skia', () => jest.requireActual('./skiaNamed.mock.js'));

jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('react-native-reanimated');

  return {
    ...base,
    useReducedMotion: (): boolean => mockReduced,
    withRepeat: (value: unknown, ...rest: unknown[]): unknown => {
      mockRepeat(value, ...rest);

      return value;
    },
    withTiming: (value: unknown, ...rest: unknown[]): unknown => {
      mockTiming(value, ...rest);

      return value;
    },
  };
});

const LENS: LensData = {
  fraction: 0.9,
  amountLabel: '477',
  caption: '10 days left',
  ariaLabel: 'lens',
  size: 'mini',
};

describe('reduced motion and settle', () => {
  beforeEach(() => {
    mockReduced = false;
    mockRepeat.mockClear();
    mockTiming.mockClear();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  });

  it('runs the idle loops when motion is allowed', async () => {
    await renderLight(<Lens lens={LENS} />);

    expect(mockRepeat).toHaveBeenCalled();
  });

  it('shows a static frame with reduced motion: no loop, no reveal timing, text kept', async () => {
    mockReduced = true;
    await renderLight(
      <>
        <Lens lens={LENS} />
        <Canvas>
          <RodLight
            glass={glassLightRn}
            rod={{ fraction: 0.5, state: 'under', size: 'category', ariaLabel: 'rod' }}
            index={0}
            width={300}
            height={10}
          />
          <TubeBeam glass={glassLightRn} fraction={0.5} index={0} width={18} height={160} />
        </Canvas>
      </>,
    );

    expect(mockRepeat).not.toHaveBeenCalled();
    expect(mockTiming).not.toHaveBeenCalled();
    expect(screen.getByText('477')).toBeTruthy();
    expect(
      screen.queryAllByTestId('skia-RoundedRect', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
  });

  it('settles to a new fraction over 420 ms', async () => {
    const { rerender } = await renderLight(<Lens lens={LENS} />);
    mockTiming.mockClear();
    await rerender(lightProviders(<Lens lens={{ ...LENS, fraction: 0.3 }} />));

    expect(mockTiming).toHaveBeenCalledWith(0.3, expect.objectContaining({ duration: 420 }));
  });

  it('jumps to the new fraction with reduced motion', async () => {
    mockReduced = true;
    const { rerender } = await renderLight(<Lens lens={LENS} />);
    await rerender(lightProviders(<Lens lens={{ ...LENS, fraction: 0.3 }} />));

    expect(mockTiming).not.toHaveBeenCalled();
  });
});
