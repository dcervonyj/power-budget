import React from 'react';
import { View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { makeStyles, useGlass } from '../../theme/index.js';
import { useLoopProgress } from '../material/motion.js';

export interface SkeletonProps {
  readonly width?: DimensionValue;
  readonly height?: number;
  /** Corner radius; defaults to the tag radius token. */
  readonly borderRadius?: number;
}

export interface SkeletonListProps {
  readonly rows?: number;
}

const SHIMMER_MS = 1200;
const REST_OPACITY = 0.55;
const SHIMMER_SWING = 0.45;
const DEFAULT_ROWS = 3;

const useStyles = makeStyles((glass) => ({
  block: { backgroundColor: glass.colors.clear, boxShadow: glass.colors.clearRim },
  list: { gap: glass.space.sm },
}));

/**
 * Glass placeholder with a soft opacity shimmer. The loop is off under reduced motion and while the
 * app is in the background, which leaves the static frame. Hidden from screen readers.
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius,
}: SkeletonProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const progress = useLoopProgress({ durationMs: SHIMMER_MS });
  const shimmer = useAnimatedStyle(() => ({
    opacity: REST_OPACITY + SHIMMER_SWING * progress.value,
  }));

  return (
    <Animated.View
      testID="skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: borderRadius ?? glass.radius.tag },
        shimmer,
      ]}
    />
  );
}

/** A few row-shaped skeletons. */
export function SkeletonList({ rows = DEFAULT_ROWS }: SkeletonListProps): React.JSX.Element {
  const styles = useStyles();
  const indices = Array.from({ length: rows }, toIndex);

  return <View style={styles.list}>{indices.map(renderRow)}</View>;
}

function toIndex(_value: unknown, index: number): number {
  return index;
}

function renderRow(index: number): React.JSX.Element {
  return <Skeleton key={index} height={56} borderRadius={20} />;
}
