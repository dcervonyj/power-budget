import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RoundedRect,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { paceMark, rodBeam, stagger } from '@power-budget/shared-app';
import type { RodProps } from '@power-budget/shared-app';
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
import { useLightLabels } from './useLightLabels.js';

const ROD_HEIGHTS: Record<RodProps['rod']['size'], number> = { pace: 14, category: 10 };
const INSET = 2;
const HATCH_STEP = 7;

const useStyles = makeStyles((glass) => ({
  root: { gap: 6 },
  track: {
    backgroundColor: glass.colors.tube,
    borderWidth: 1,
    borderColor: firstColor(glass.colors.tubeRim),
  },
  pace: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: glass.colors.pace },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.xxs,
    paddingHorizontal: glass.space.xs,
    paddingVertical: 2,
    borderRadius: glass.radius.tag,
  },
  tagText: { fontFamily: 'Geist_600SemiBold', fontSize: glass.type.tag.mobile },
}));

export interface RodComponentProps extends RodProps {
  /** Position in a list; staggers the entrance and desynchronises the loops. */
  readonly index?: number;
  /** Text of the over / paid tag; defaults to the translated "Over budget" / "Paid". */
  readonly tagLabel?: string;
}

/**
 * Horizontal glass rod (14 pace / 10 category). The light's length is the money left (fraction);
 * the mark is the part of the month still to come. Over budget shows a hatch and a tag, paid
 * shows a tag, no light either way.
 */
export function Rod({ rod, index = 0, tagLabel }: RodComponentProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const labels = useLightLabels();
  const [width, setWidth] = useState(0);
  const height = ROD_HEIGHTS[rod.size];
  const tagKind = rod.state === 'over' || rod.state === 'paid' ? rod.state : undefined;

  return (
    <View
      testID="rod"
      accessibilityRole="image"
      accessible
      accessibilityLabel={rod.ariaLabel}
      style={styles.root}
    >
      <View
        testID="rod-track"
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.track, { height, borderRadius: height / 2 }]}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ position: 'absolute', left: -1, top: -1 }}
        >
          <Canvas style={{ width, height }}>
            {width > 0 ? (
              <RodLight glass={glass} rod={rod} index={index} width={width} height={height} />
            ) : null}
          </Canvas>
        </View>
        {rod.paceProgress === undefined ? null : (
          <View
            testID="rod-pace"
            style={[
              styles.pace,
              { left: paceMark(rod.paceProgress), top: -4, height: height + 8, marginLeft: -1 },
            ]}
          />
        )}
      </View>
      {tagKind === undefined ? null : (
        <View
          testID="rod-tag"
          style={[
            styles.tag,
            { backgroundColor: tagKind === 'over' ? glass.colors.overTint : glass.colors.fill2 },
          ]}
        >
          <RodTagIcon kind={tagKind} />
          <Text
            style={[
              styles.tagText,
              { color: tagKind === 'over' ? glass.colors.over : glass.colors.dim },
            ]}
          >
            {tagLabel === undefined ? labels.rodTag(tagKind) : tagLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

interface RodLightProps {
  readonly glass: GlassRnTheme;
  readonly rod: RodProps['rod'];
  readonly index: number;
  readonly width: number;
  readonly height: number;
}

/** Hatch (over) and beam (under) drawn in the rod's inner area. */
export function RodLight({ glass, rod, index, width, height }: RodLightProps): React.JSX.Element {
  const inner = { x: INSET, y: INSET, width: width - 2 * INSET, height: height - 2 * INSET };
  const radius = height / 2 - INSET;
  const beam = rodBeam(rod.state === 'under' ? rod.fraction : 0);

  return (
    <Group clip={rrect(rect(1, 1, width - 2, height - 2), height / 2 - 1, height / 2 - 1)}>
      {rod.state === 'over' ? (
        <Path
          path={hatchPath(inner.width, inner.height)}
          style="stroke"
          strokeWidth={1.5}
          color={firstColor(glass.colors.overHatch)}
          opacity={0.5}
          transform={[{ translateX: INSET }, { translateY: INSET }]}
        />
      ) : null}
      {beam.hasSpark ? (
        <RodBeam
          glass={glass}
          fraction={Number.parseFloat(beam.width) / 100}
          index={index}
          area={inner}
          radius={radius}
        />
      ) : null}
    </Group>
  );
}

interface BeamProps {
  readonly glass: GlassRnTheme;
  readonly fraction: number;
  readonly index: number;
  readonly area: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly radius: number;
}

function RodBeam({ glass, fraction, index, area, radius }: BeamProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const loops = useLoopsEnabled();
  const delays = stagger(index);
  const amber = parseLayerStops(glass.colors.beamH, 1);
  const shine = parseLayerStops(glass.colors.beamH, 0);
  const reveal = useReveal(!reducedMotion, REVEAL_MS, Number.parseInt(delays.delay, 10));
  const flicker = useLoop(loops, {
    durationMs: BEAM_FLICKER_MS / 2,
    delayMs: Number.parseInt(delays.flickerDelay, 10),
    reverse: true,
  });
  const travel = useLoop(loops, {
    durationMs: TRAVEL_MS,
    delayMs: Number.parseInt(delays.sparkDelay, 10),
  });
  const beamWidth = useDerivedValue(() => area.width * fraction * reveal.value);
  const opacity = useDerivedValue(() => flickerOpacity(flicker.value));
  const sparkX = useDerivedValue(() => area.x + area.width * fraction * travel.value);
  const sparkOpacity = useDerivedValue(() => travelOpacity(travel.value));
  const centerY = area.y + area.height / 2;
  const sparkColor = parseGradientStops(glass.colors.spark).colors[0];

  return (
    <Group opacity={opacity}>
      <RoundedRect
        x={area.x}
        y={area.y}
        width={beamWidth}
        height={area.height}
        r={Math.min(4, radius)}
        color={firstColor(glass.colors.bloom)}
      >
        <BlurMask blur={6} style="normal" />
      </RoundedRect>
      <RoundedRect
        x={area.x}
        y={area.y}
        width={beamWidth}
        height={area.height}
        r={Math.min(4, radius)}
      >
        <LinearGradient
          start={vec(area.x, 0)}
          end={vec(area.x + area.width * fraction, 0)}
          colors={amber.colors}
          positions={amber.positions}
        />
      </RoundedRect>
      <RoundedRect
        x={area.x}
        y={area.y}
        width={beamWidth}
        height={area.height}
        r={Math.min(4, radius)}
      >
        <LinearGradient
          start={vec(0, area.y)}
          end={vec(0, area.y + area.height)}
          colors={shine.colors}
          positions={shine.positions}
        />
      </RoundedRect>
      <Circle cx={sparkX} cy={centerY} r={3} opacity={sparkOpacity} color={sparkColor}>
        <BlurMask blur={2} style="normal" />
      </Circle>
    </Group>
  );
}

function RodTagIcon({ kind }: { readonly kind: 'over' | 'paid' }): React.JSX.Element {
  const glass = useGlass();
  const d = kind === 'over' ? 'M12 4 L21 20 H3 Z M12 10 V14 M12 17 V17.2' : 'M5 12.5 L10 17 L19 7';

  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
    >
      <SvgPath
        d={d}
        stroke={kind === 'over' ? glass.colors.over : glass.colors.dim}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function hatchPath(width: number, height: number): string {
  const segments: string[] = [];
  for (let x = -height; x < width; x += HATCH_STEP) {
    segments.push(`M${x} ${height} L${x + height} 0`);
  }

  return segments.join(' ');
}
