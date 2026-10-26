import React from 'react';
import { AccessibilityInfo, AppState, Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useLoopsEnabled, useReducedMotion } from '../useMotion.js';

let mockReanimatedReduced = false;

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: (): boolean => mockReanimatedReduced,
}));

const a11yListeners: Array<(enabled: boolean) => void> = [];
const appStateListeners: Array<(state: string) => void> = [];

function Probe(): React.JSX.Element {
  return <Text testID="probe">{`${String(useReducedMotion())}|${String(useLoopsEnabled())}`}</Text>;
}

describe('motion hooks', () => {
  beforeEach(() => {
    mockReanimatedReduced = false;
    a11yListeners.length = 0;
    appStateListeners.length = 0;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, cb) => {
      a11yListeners.push(cb as (enabled: boolean) => void);

      return { remove: jest.fn() };
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      appStateListeners.push(cb as (state: string) => void);

      return { remove: jest.fn() };
    });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enables loops when motion is allowed and the app is active', async () => {
    await render(<Probe />);

    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(screen.getByTestId('probe').props.children).toBe('false|true');
  });

  it('reports reduced motion from Reanimated', async () => {
    mockReanimatedReduced = true;
    await render(<Probe />);

    expect(screen.getByTestId('probe').props.children).toBe('true|false');
  });

  it('reports reduced motion from AccessibilityInfo, initially and on change', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<Probe />);

    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('true|false'));

    await act(async () => {
      a11yListeners.forEach((listener) => listener(false));
    });

    expect(screen.getByTestId('probe').props.children).toBe('false|true');
  });

  it('pauses loops while the app is in the background', async () => {
    await render(<Probe />);

    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
    });
    expect(screen.getByTestId('probe').props.children).toBe('false|false');

    await act(async () => {
      appStateListeners.forEach((listener) => listener('active'));
    });
    expect(screen.getByTestId('probe').props.children).toBe('false|true');
  });
});
