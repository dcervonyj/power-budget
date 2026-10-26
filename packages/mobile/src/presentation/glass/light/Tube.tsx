import React, { useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  RoundedRect,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { rodBeam } from '@power-budget/shared-app';
import type { TubeProps } from '@power-budget/shared-app';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';
import { makeStyles, useGlass, useLoopsEnabled, useReducedMotion } from '../../theme/index.js';
import { firstColor, parseGradientStops, parseLayerStops } from './cssColors.js';
import {
  BEAM_FLICKER_MS,
  REVEAL_MS,
  TRAVEL_MS,
  flickerOpacity,
  travelOpacity,
  useLoop,
  useReveal,
} from './lightMotion.js';

const TUBE_WIDTH = 18;
const INSET = 2;

const useStyles = makeStyles((glass) => ({
  track: {
    width: TUBE_WIDTH,
    borderRadius: TUBE_WIDTH / 2,
    backgroundColor: glass.colors.tube,
    borderWidth: 1,
    borderColor: firstColor(glass.colors.tubeRim),
  },
}));

export interface TubeComponentProps extends TubeProps {
  readonly height?: number;
  readonly index?: number;
}

/** Vertical glass tube (savings goal, what-if): the light rises from the bottom by `fraction`. */
export function Tube({ tube, height = 160, index = 0 }: TubeComponentProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const beam = rodBeam(tube.fraction);

  return (
    <View
      testID="tube"
      accessibilityRole="image"
      accessible
      accessibilityLabel={tube.ariaLabel}
      onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}
      style={[styles.track, { height }]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ position: 'absolute', left: -1, top: -1 }}
      >
        <Canvas style={{ width: size.width, height: size.height }}>
          {size.width > 0 && beam.hasSpark ? (
            <TubeBeam
              glass={glass}
              fraction={Number.parseFloat(beam.width) / 100}
              index={index}
              width={size.width}
              height={size.height}
            />
          ) : null}
        </Canvas>
      </View>
    </View>
  );
}

interface TubeBeamProps {
  readonly glass: GlassRnTheme;
  readonly fraction: number;
  readonly index: number;
  readonly width: number;
  readonly height: number;
}

/** The rising light, drawn in the tube's inner area. */
export function TubeBeam({
  glass,
  fraction,
  index,
  width,
  height,
}: TubeBeamProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const loops = useLoopsEnabled();
  const amber = parseLayerStops(glass.colors.beamV, 1);
  const shine = parseLayerStops(glass.colors.beamV, 0);
  const area = { x: INSET, y: INSET, width: width - 2 * INSET, height: height - 2 * INSET };
  const bottom = area.y + area.height;
  const reveal = useReveal(!reducedMotion, REVEAL_MS, index * 80);
  const flicker = useLoop(loops, {
    durationMs: BEAM_FLICKER_MS / 2,
    delayMs: (index * 370) % 2000,
    reverse: true,
  });
  const travel = useLoop(loops, { durationMs: TRAVEL_MS, delayMs: (index * 370) % 2000 });
  const beamHeight = useDerivedValue(() => area.height * fraction * reveal.value);
  const beamTop = useDerivedValue(() => bottom - beamHeight.value);
  const opacity = useDerivedValue(() => flickerOpacity(flicker.value));
  const sparkY = useDerivedValue(() => bottom - area.height * fraction * travel.value);
  const sparkOpacity = useDerivedValue(() => travelOpacity(travel.value));
  const sparkColor = parseGradientStops(glass.colors.spark).colors[0];

  return (
    <Group
      opacity={opacity}
      clip={rrect(rect(1, 1, width - 2, height - 2), width / 2 - 1, width / 2 - 1)}
    >
      <RoundedRect
        x={area.x}
        y={beamTop}
        width={area.width}
        height={beamHeight}
        r={4}
        color={firstColor(glass.colors.bloom)}
      >
        <BlurMask blur={6} style="normal" />
      </RoundedRect>
      <RoundedRect x={area.x} y={beamTop} width={area.width} height={beamHeight} r={4}>
        <LinearGradient
          start={vec(0, bottom)}
          end={vec(0, bottom - area.height * fraction)}
          colors={amber.colors}
          positions={amber.positions}
        />
      </RoundedRect>
      <RoundedRect x={area.x} y={beamTop} width={area.width} height={beamHeight} r={4}>
        <LinearGradient
          start={vec(area.x, 0)}
          end={vec(area.x + area.width, 0)}
          colors={shine.colors}
          positions={shine.positions}
        />
      </RoundedRect>
      <Circle cx={width / 2} cy={sparkY} r={3} opacity={sparkOpacity} color={sparkColor}>
        <BlurMask blur={2} style="normal" />
      </Circle>
    </Group>
  );
}
