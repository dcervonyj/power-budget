import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useGlass } from '../../theme/index.js';
import { DecorLayer } from './GlassDecor.js';
import { materialShadows } from './materialStyle.js';
import { useLoopProgress } from './motion.js';

export interface DepthPanesProps {
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

interface PaneSpec {
  readonly x: number;
  readonly y: number;
  readonly rotate: string;
  /** Start of the float loop, as the fraction of one leg (the CSS `-20s` delay of a 40 s leg). */
  readonly phase: number;
}

const PANES: readonly PaneSpec[] = [
  { x: 18, y: -14, rotate: '2.5deg', phase: 0 },
  { x: -14, y: 12, rotate: '-1.5deg', phase: 0.5 },
];
const FLOAT = { x: -24, y: 18 } as const;

/** Two offset clear panes peeking out behind its children (the hero stack). Panes are decorative. */
export function DepthPanes({ radius, style, children }: DepthPanesProps): React.JSX.Element {
  const glass = useGlass();
  const cornerRadius = radius ?? glass.radius.mobilePanel;

  return (
    <View style={style}>
      {PANES.map((pane) => (
        <Pane key={pane.rotate} pane={pane} radius={cornerRadius} />
      ))}
      <View>{children}</View>
    </View>
  );
}

function Pane({ pane, radius }: { pane: PaneSpec; radius: number }): React.JSX.Element {
  const glass = useGlass();
  const shadows = materialShadows(glass.colors, 'clear', 1);
  const progress = useLoopProgress({
    durationMs: glass.motion.layeredPaneFloat.durationMs,
    phase: pane.phase,
  });
  const float = useAnimatedStyle(() => ({
    transform: [{ translateX: FLOAT.x * progress.value }, { translateY: FLOAT.y * progress.value }],
  }));

  return (
    <DecorLayer name="depth-pane">
      <Animated.View style={[StyleSheet.absoluteFill, float]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              backgroundColor: glass.colors.clear,
              boxShadow: [shadows.inset, shadows.outer].filter(isPresent).join(', '),
              transform: [{ translateX: pane.x }, { translateY: pane.y }, { rotate: pane.rotate }],
            },
          ]}
        />
      </Animated.View>
    </DecorLayer>
  );
}

function isPresent(layer: string): boolean {
  return layer !== '';
}
