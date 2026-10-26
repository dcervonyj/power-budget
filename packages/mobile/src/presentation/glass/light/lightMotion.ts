import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { EasingFunction, EasingFunctionFactory, SharedValue } from 'react-native-reanimated';
import { glassDarkTheme } from '@power-budget/design-tokens/glass';

const MOTION = glassDarkTheme.motion;
const BEZIER = /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/;

/** Duration of the Add screen `settle` transition (the sheet token, 420 ms). */
export const SETTLE_MS = MOTION.sheet.durationMs;
export const REVEAL_MS = MOTION.reveal.durationMs;
export const GLOWIN_MS = MOTION.glowin.durationMs;
export const GLOWIN_DELAY_MS = 300;
export const BLOOM_MS = MOTION.bloom.durationMs;
export const CAUSTIC_MS = MOTION.caustic.durationMs;
export const FILM_MS = MOTION.film.durationMs;
export const TRAVEL_MS = MOTION.travel.durationMs;
export const LENS_FLICKER_MS = MOTION.flicker.durationMs[1];
export const BEAM_FLICKER_MS = MOTION.flicker.durationMs[0];
export const TWINKLE_MS: readonly number[] = [2800, 3400, 3100];
export const TWINKLE_DELAYS_MS: readonly number[] = [400, 1300, 2100];

export interface CoreMetrics {
  /** Core radius as a share of the lens diameter. */
  readonly radius: number;
  readonly opacity: number;
}

/**
 * R2.4 core size and brightness for a lens fraction. Runs on the UI thread, so it is a worklet;
 * a spec keeps it equal to `lensGeometry` of shared-app.
 */
export function coreMetrics(fraction: number): CoreMetrics {
  'worklet';
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) {
    return { radius: 0, opacity: 0 };
  }

  return { radius: Math.min(62, 36 + 64 * f) / 200, opacity: 0.62 + 0.38 * f };
}

/** Fade in at both ends of a travelling spark (d7-travel: 12 % in, 12 % out). */
export function travelOpacity(progress: number): number {
  'worklet';
  if (progress < 0.12) {
    return progress / 0.12;
  }
  if (progress > 0.88) {
    return (1 - progress) / 0.12;
  }

  return 1;
}

/** d7-flicker as a 0..1 loop: full brightness at 0, dimmest (.84) at 1. */
export function flickerOpacity(progress: number): number {
  'worklet';

  return 1 - 0.16 * progress;
}

export function motionEasing(css: string): EasingFunction | EasingFunctionFactory {
  const match = BEZIER.exec(css);
  if (match === null) {
    return Easing.linear;
  }

  return Easing.bezier(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
}

export interface LoopOptions {
  readonly durationMs: number;
  readonly delayMs?: number;
  /** Alternate direction (a CSS `alternate` loop); otherwise it restarts at 0. */
  readonly reverse?: boolean;
  /** Value shown when loops are off (reduced motion, app in background). */
  readonly rest?: number;
}

/** A 0..1 looping value; with `enabled` false nothing runs and it holds `rest`: a static frame. */
export function useLoop(enabled: boolean, options: LoopOptions): SharedValue<number> {
  const { durationMs, delayMs = 0, reverse = false, rest = 0 } = options;
  const progress = useSharedValue(rest);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = rest;

      return undefined;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: durationMs }), -1, reverse),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [enabled, durationMs, delayMs, reverse, rest, progress]);

  return progress;
}

/** A one-shot 0..1 reveal (beam, core glow-in); with `enabled` false it shows the end state. */
export function useReveal(
  enabled: boolean,
  durationMs: number,
  delayMs: number,
): SharedValue<number> {
  const progress = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      progress.value = 1;

      return undefined;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: durationMs, easing: motionEasing(MOTION.reveal.easing) }),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [enabled, durationMs, delayMs, progress]);

  return progress;
}

/**
 * The `settle` transition (Add screen): when the target fraction changes (a typed amount lowers
 * the new safe to spend) the light eases to it over 420 ms. Reduced motion jumps to the value.
 */
export function useSettle(target: number, reducedMotion: boolean): SharedValue<number> {
  const settled = useSharedValue(target);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(settled);
      settled.value = target;

      return undefined;
    }
    settled.value = withTiming(target, {
      duration: SETTLE_MS,
      easing: motionEasing(MOTION.sheet.easing),
    });

    return () => {
      cancelAnimation(settled);
    };
  }, [target, reducedMotion, settled]);

  return settled;
}
