import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Fill,
  Group,
  RadialGradient,
  RoundedRect,
  LinearGradient,
} from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useGlass } from '../../theme/index.js';
import { parseLinearGradient, parseRadialGradient, transparentOf } from './cssParse.js';
import { GradientFill } from './GradientFill.js';
import { useLoopProgress, usePassProgress } from './motion.js';

/** Slot of a glint sweep on the screen: 0, 4 s or 8 s stagger. At most three panels sweep. */
export type SweepSlot = 0 | 1 | 2;

export interface Size {
  readonly width: number;
  readonly height: number;
}

interface DecorProps {
  readonly size: Size;
  readonly radius: number;
}

const SWEEP_WIDTH = 0.22;
const SWEEP_FROM = -1.4;
const SWEEP_TO = 3.8;
const SWEEP_PASS_FRACTION = 0.14;
const FILM_SPAN = 3;
const FILM_TRAVEL = 2;

/** Wraps a purely visual layer: invisible to screen readers and to touches. */
export function DecorLayer({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View
      testID={`glass-decor-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {children}
    </View>
  );
}

/** Top-left highlight (`specular` token) as an elliptical Skia radial gradient. */
export function Specular({ size }: DecorProps): React.JSX.Element {
  const glass = useGlass();
  const gradient = parseRadialGradient(glass.colors.specular);
  const radiusX = gradient.rx * size.width;
  const squash = (gradient.ry * size.height) / radiusX;

  return (
    <DecorLayer name="specular">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group
          transform={[
            { translateX: gradient.cx * size.width },
            { translateY: gradient.cy * size.height },
            { scaleY: squash },
          ]}
        >
          <Fill>
            <RadialGradient
              c={{ x: 0, y: 0 }}
              r={radiusX}
              colors={gradient.stops.map(stopColor)}
              positions={gradient.stops.map(stopOffset)}
            />
          </Fill>
        </Group>
      </Canvas>
    </DecorLayer>
  );
}

/** 1 px thin-film rim: the iridescent gradient slides across the border (`d7-film`). */
export function Film({ size, radius }: DecorProps): React.JSX.Element {
  const glass = useGlass();
  const gradient = parseLinearGradient(glass.colors.irid);
  const progress = useLoopProgress({ durationMs: glass.motion.film.durationMs });
  const { width, height } = size;
  const radians = (gradient.angleDeg * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);
  const halfLength = (FILM_SPAN * (Math.abs(width * dirX) + Math.abs(height * dirY))) / 2;
  const start = useDerivedValue(() => {
    const cx = (FILM_SPAN / 2) * width - FILM_TRAVEL * width * progress.value;

    return { x: cx - dirX * halfLength, y: height / 2 - dirY * halfLength };
  });
  const end = useDerivedValue(() => {
    const cx = (FILM_SPAN / 2) * width - FILM_TRAVEL * width * progress.value;

    return { x: cx + dirX * halfLength, y: height / 2 + dirY * halfLength };
  });

  return (
    <DecorLayer name="film">
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 1}
          r={Math.max(0, radius - 0.5)}
          style="stroke"
          strokeWidth={1}
        >
          <LinearGradient
            start={start}
            end={end}
            colors={gradient.stops.map(stopColor)}
            positions={gradient.stops.map(stopOffset)}
          />
        </RoundedRect>
      </Canvas>
    </DecorLayer>
  );
}

/** A glint strip crossing the panel every 12 s (`d7-sweep`). */
export function Sweep({ size, slot }: { size: Size; slot: SweepSlot }): React.JSX.Element {
  const glass = useGlass();
  const { sweep } = glass.motion;
  const progress = usePassProgress(
    sweep.durationMs,
    SWEEP_PASS_FRACTION,
    sweep.delayMs + (sweep.staggerDelaysMs[slot] ?? 0),
    sweep.easing,
  );
  const stripWidth = size.width * SWEEP_WIDTH;
  const strip = useAnimatedStyle(() => ({
    transform: [
      { translateX: (SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * progress.value) * stripWidth },
      { skewX: '-16deg' },
    ],
  }));

  return (
    <DecorLayer name="sweep">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -0.3 * size.height,
            height: 1.6 * size.height,
            left: 0,
            width: stripWidth,
          },
          strip,
        ]}
      >
        <GradientFill
          kind="linear"
          stops={[
            { color: transparentOf(glass.colors.sweep), offset: 0 },
            { color: glass.colors.sweep, offset: 0.5 },
            { color: transparentOf(glass.colors.sweep), offset: 1 },
          ]}
        />
      </Animated.View>
    </DecorLayer>
  );
}

function stopColor(stop: { color: string }): string {
  return stop.color;
}

function stopOffset(stop: { offset: number }): number {
  return stop.offset;
}
