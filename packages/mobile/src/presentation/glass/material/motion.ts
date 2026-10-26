import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';
import { useGlass } from '../../theme/ThemeProvider.js';
import { useLoopsEnabled, useReducedMotion } from '../../theme/useMotion.js';
import { parseCubicBezier } from './cssParse.js';

export interface LoopOptions {
  readonly durationMs: number;
  readonly delayMs?: number;
  /** Where in the first leg the loop starts, 0..1 (a negative CSS delay). */
  readonly phase?: number;
}

const RISE_FROM_Y = 18;
const RISE_FROM_SCALE = 0.96;

/**
 * Alternating 0..1 loop (CSS `infinite alternate`, ease-in-out). It stays at 0, the static frame,
 * while loops are off: reduced motion or the app in the background.
 */
export function useLoopProgress({
  durationMs,
  delayMs = 0,
  phase = 0,
}: LoopOptions): SharedValue<number> {
  const progress = useSharedValue(0);
  const enabled = useLoopsEnabled();

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;

      return undefined;
    }
    progress.value = phase;
    const config = { duration: durationMs, easing: Easing.inOut(Easing.ease) };
    const back = withSequence(withTiming(0, config), withTiming(1, config));
    progress.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { ...config, duration: durationMs * (1 - phase) }),
        withRepeat(back, -1, false),
      ),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [enabled, progress, durationMs, delayMs, phase]);

  return progress;
}

/**
 * Repeating 0..1 pass followed by a rest (the glint sweep: a pass of `passFraction` of the period,
 * then idle). Stays at 0 while loops are off.
 */
export function usePassProgress(
  periodMs: number,
  passFraction: number,
  delayMs: number,
  easingCss: string,
): SharedValue<number> {
  const progress = useSharedValue(0);
  const enabled = useLoopsEnabled();

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;

      return undefined;
    }
    const pass = { duration: periodMs * passFraction, easing: bezier(easingCss) };
    const rest = { duration: periodMs * (1 - passFraction) };
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(withSequence(withTiming(1, pass), withTiming(1, rest)), -1, false),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [enabled, progress, periodMs, passFraction, delayMs, easingCss]);

  return progress;
}

/**
 * Panel entrance (`rise`): opacity 0, 18 px down, scale .96 to the resting frame, staggered by one
 * step per index and held at the first frame until its delay (backwards fill). Without an index,
 * or under reduced motion, the panel is simply at rest.
 */
export function useRiseStyle(index: number | undefined): AnimatedStyle<ViewStyle> {
  const glass = useGlass();
  const reduced = useReducedMotion();
  const animated = index !== undefined && !reduced;
  const progress = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (!animated) {
      cancelAnimation(progress);
      progress.value = 1;

      return undefined;
    }
    progress.value = 0;
    progress.value = withDelay(riseDelayMs(glass, index), withTiming(1, riseConfig(glass)));

    return () => {
      cancelAnimation(progress);
    };
  }, [animated, index, glass, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: RISE_FROM_Y * (1 - progress.value) },
      { scale: RISE_FROM_SCALE + (1 - RISE_FROM_SCALE) * progress.value },
    ],
  }));
}

export function bezier(css: string): ReturnType<typeof Easing.bezier> {
  const [x1, y1, x2, y2] = parseCubicBezier(css);

  return Easing.bezier(x1, y1, x2, y2);
}

function riseDelayMs(glass: GlassRnTheme, index: number | undefined): number {
  return glass.motion.rise.staggerMs * Math.max(0, Math.floor(index ?? 0));
}

function riseConfig(glass: GlassRnTheme): { duration: number; easing: ReturnType<typeof bezier> } {
  return { duration: glass.motion.rise.durationMs, easing: bezier(glass.motion.rise.easing) };
}
