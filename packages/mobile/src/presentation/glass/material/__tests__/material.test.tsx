import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ThemeProvider } from '../../../theme/index.js';
import { AmbientField } from '../AmbientField.js';
import { DepthPanes } from '../DepthPanes.js';
import { GlassPanel } from '../GlassPanel.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockMotionOff = false;

jest.mock('../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => mockMotionOff,
  useLoopsEnabled: (): boolean => !mockMotionOff,
  useAppActive: (): boolean => true,
}));

function renderThemed(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

async function layOut(): Promise<void> {
  await fireEvent(screen.getByTestId('glass-panel'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 160 } },
  });
}

describe('AmbientField', () => {
  it('is hidden from the accessibility tree', async () => {
    await renderThemed(<AmbientField />);
    const field = screen.getByTestId('glass-ambient', { includeHiddenElements: true });

    expect(field.props.accessibilityElementsHidden).toBe(true);
    expect(field.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.queryByTestId('glass-ambient')).toBeNull();
  });
});

describe('GlassPanel', () => {
  it('renders its children above hidden decor', async () => {
    await renderThemed(
      <GlassPanel decor={{ specular: true, film: true, sweep: 1 }}>
        <Text>panel content</Text>
      </GlassPanel>,
    );
    await layOut();

    expect(screen.getByText('panel content')).toBeTruthy();
    for (const name of ['backdrop', 'specular', 'film', 'sweep']) {
      const decor = screen.getByTestId(`glass-decor-${name}`, { includeHiddenElements: true });

      expect(decor.props.accessibilityElementsHidden).toBe(true);
      expect(decor.props.importantForAccessibility).toBe('no-hide-descendants');
    }
  });

  it('draws only the decor that was asked for', async () => {
    await renderThemed(
      <GlassPanel decor={{ specular: true }}>
        <Text>plain</Text>
      </GlassPanel>,
    );
    await layOut();

    expect(
      screen.getByTestId('glass-decor-specular', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.queryByTestId('glass-decor-film', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('glass-decor-sweep', { includeHiddenElements: true })).toBeNull();
  });

  it('blurs frosted and tinted panels but not clear ones', async () => {
    const { rerender } = await renderThemed(
      <GlassPanel material="frosted">
        <Text>x</Text>
      </GlassPanel>,
    );
    expect(screen.getByTestId('glass-blur', { includeHiddenElements: true })).toBeTruthy();

    await rerender(
      <ThemeProvider>
        <GlassPanel material="tinted">
          <Text>x</Text>
        </GlassPanel>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('glass-blur', { includeHiddenElements: true })).toBeTruthy();

    await rerender(
      <ThemeProvider>
        <GlassPanel material="clear">
          <Text>x</Text>
        </GlassPanel>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('glass-blur', { includeHiddenElements: true })).toBeNull();
  });

  it('lets the caller style win when there is no rise', async () => {
    await renderThemed(
      <GlassPanel style={{ opacity: 0.5 }}>
        <Text>x</Text>
      </GlassPanel>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('glass-panel').props.style).opacity).toBe(0.5);
  });
});

describe('DepthPanes', () => {
  it('renders two hidden panes and the children', async () => {
    await renderThemed(
      <DepthPanes>
        <Text>hero</Text>
      </DepthPanes>,
    );
    const panes = screen.getAllByTestId('glass-decor-depth-pane', { includeHiddenElements: true });

    expect(panes).toHaveLength(2);
    for (const pane of panes) {
      expect(pane.props.accessibilityElementsHidden).toBe(true);
      expect(pane.props.importantForAccessibility).toBe('no-hide-descendants');
    }
    expect(screen.getByText('hero')).toBeTruthy();
  });
});

describe('motion', () => {
  const field = (
    <>
      <AmbientField />
      <DepthPanes>
        <GlassPanel rise={1} decor={{ film: true, sweep: 0 }}>
          <Text>x</Text>
        </GlassPanel>
      </DepthPanes>
    </>
  );

  afterEach(() => {
    mockMotionOff = false;
    jest.restoreAllMocks();
  });

  it('staggers the rise by index with the token duration', async () => {
    const delay = jest.spyOn(Reanimated, 'withDelay');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await renderThemed(
      <GlassPanel rise={2}>
        <Text>x</Text>
      </GlassPanel>,
    );

    expect(delay).toHaveBeenCalledWith(160, 1);
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 620 }));
  });

  it('rests at full opacity and scale under reduced motion', async () => {
    mockMotionOff = true;
    const delay = jest.spyOn(Reanimated, 'withDelay');
    await renderThemed(
      <GlassPanel rise={2}>
        <Text>x</Text>
      </GlassPanel>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('glass-panel').props.style);

    expect(delay).not.toHaveBeenCalled();
    expect(style.opacity).toBe(1);
    expect(style.transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
  });

  it('starts the idle loops and the rise when motion is allowed', async () => {
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await renderThemed(field);
    await layOut();

    expect(repeat).toHaveBeenCalled();
    expect(timing).toHaveBeenCalled();
  });

  it('animates nothing under reduced motion', async () => {
    mockMotionOff = true;
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await renderThemed(field);
    await layOut();

    expect(repeat).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByText('x')).toBeTruthy();
  });
});
