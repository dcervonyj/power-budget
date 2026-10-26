import React from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { makeStyles, useGlass } from '../../theme/index.js';
import { transparentOf } from './cssParse.js';
import { GradientFill } from './GradientFill.js';
import { useLoopProgress } from './motion.js';

export interface AmbientFieldProps {
  /** Honey glow under the hero; its slot is where the hero sits. */
  readonly glow?: boolean;
  readonly glowPosition?: { readonly top: `${number}%`; readonly left: `${number}%` };
  readonly style?: ViewStyle;
}

type BlobKey = 'b1' | 'b2' | 'b3';

interface BlobSpec {
  readonly key: BlobKey;
  readonly size: number;
  readonly top: `${number}%`;
  readonly left: `${number}%`;
  /** Drift target of the CSS `d7-drift*` keyframes. */
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
}

const BLOBS: readonly BlobSpec[] = [
  { key: 'b1', size: 760, top: '-18%', left: '-10%', dx: 90, dy: 70, scale: 1.12 },
  { key: 'b2', size: 680, top: '30%', left: '62%', dx: -110, dy: -60, scale: 0.92 },
  { key: 'b3', size: 620, top: '66%', left: '14%', dx: 80, dy: -70, scale: 1.08 },
];

const BEAM_LEFTS: readonly `${number}%`[] = ['22%', '68%'];
const FAR_SLABS: readonly ViewStyle[] = [
  { top: '12%', left: '70%', width: 360, height: 220, transform: [{ rotate: '-8deg' }] },
  { top: '70%', left: '4%', width: 300, height: 190, transform: [{ rotate: '6deg' }] },
];
const GLOW_BREATHE_MS = 6000;
const GLOW_MIN_OPACITY = 0.6;

const useStyles = makeStyles((glass) => ({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: glass.colors.base,
  },
  fill: { position: 'absolute' },
  glow: { width: 560, height: 420, borderRadius: 280 },
  beam: { top: '-20%', bottom: '-20%', width: 120, transform: [{ rotate: '24deg' }] },
  slab: {
    borderRadius: glass.radius.mobilePanel,
    backgroundColor: glass.colors.far,
    borderWidth: 1,
    borderColor: glass.colors.farEdge,
  },
}));

/** Decorative light field behind a screen: drifting blobs, honey glow, beams, far slabs. */
export function AmbientField({
  glow = true,
  glowPosition = { top: '14%', left: '38%' },
  style,
}: AmbientFieldProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <View
      testID="glass-ambient"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, style]}
    >
      {BLOBS.map((blob, index) => (
        <Blob key={blob.key} blob={blob} color={glass.colors[blob.key]} index={index} />
      ))}
      {glow ? <Glow color={glass.colors.glow} position={glowPosition} /> : null}
      {BEAM_LEFTS.map((left) => (
        <View key={left} style={[styles.fill, styles.beam, { left }]}>
          <GradientFill
            kind="linear"
            stops={[
              { color: transparentOf(glass.colors.beam), offset: 0 },
              { color: glass.colors.beam, offset: 0.5 },
              { color: transparentOf(glass.colors.beam), offset: 1 },
            ]}
          />
        </View>
      ))}
      {FAR_SLABS.map((slab) => (
        <View key={slab.top as string} style={[styles.fill, styles.slab, slab]} />
      ))}
    </View>
  );
}

function Blob({
  blob,
  color,
  index,
}: {
  blob: BlobSpec;
  color: string;
  index: number;
}): React.JSX.Element {
  const glass = useGlass();
  const progress = useLoopProgress({ durationMs: glass.motion.ambientDrift[index] ?? 52000 });
  const drift = useDriftStyle(progress, blob);
  const styles = useStyles();

  return (
    <Animated.View
      style={[
        styles.fill,
        { top: blob.top, left: blob.left, width: blob.size, height: blob.size },
        drift,
      ]}
    >
      <GradientFill
        kind="radial"
        stops={[
          { color, offset: 0 },
          { color: transparentOf(color), offset: 1 },
        ]}
      />
    </Animated.View>
  );
}

function Glow({
  color,
  position,
}: {
  color: string;
  position: NonNullable<AmbientFieldProps['glowPosition']>;
}): React.JSX.Element {
  const styles = useStyles();
  const progress = useLoopProgress({ durationMs: GLOW_BREATHE_MS });
  const breathe = useAnimatedStyle(() => ({
    opacity: 1 - (1 - GLOW_MIN_OPACITY) * progress.value,
  }));

  return (
    <Animated.View style={[styles.fill, styles.glow, position, breathe]}>
      <GradientFill
        kind="radial"
        stops={[
          { color, offset: 0 },
          { color: transparentOf(color), offset: 1 },
        ]}
      />
    </Animated.View>
  );
}

function useDriftStyle(
  progress: SharedValue<number>,
  blob: BlobSpec,
): ReturnType<typeof useAnimatedStyle> {
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: blob.dx * progress.value },
      { translateY: blob.dy * progress.value },
      { scale: 1 + (blob.scale - 1) * progress.value },
    ],
  }));
}
