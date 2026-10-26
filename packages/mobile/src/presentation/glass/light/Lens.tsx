import React from 'react';
import { Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  BlurMask,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { lensGeometry } from '@power-budget/shared-app';
import type { LensProps } from '@power-budget/shared-app';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';
import { makeStyles, useGlass, useLoopsEnabled, useReducedMotion } from '../../theme/index.js';
import { firstColor, parseGradientStops } from './cssColors.js';
import {
  BLOOM_MS,
  CAUSTIC_MS,
  FILM_MS,
  GLOWIN_DELAY_MS,
  GLOWIN_MS,
  LENS_FLICKER_MS,
  TWINKLE_DELAYS_MS,
  TWINKLE_MS,
  coreMetrics,
  flickerOpacity,
  useLoop,
  useReveal,
  useSettle,
} from './lightMotion.js';

/** Frame diameters per size: 220 on mobile, 120 for the Add screen mini lens. */
const LENS_SIZES: Record<LensProps['lens']['size'], number> = { hero: 264, mobile: 220, mini: 120 };
const REFERENCE_SIZE = 220;
/** Room around the glass for the bloom, in reference pixels. */
const BLOOM_PAD = 70;
const CORE_CENTER_Y = 0.76;
const SPECS: readonly { readonly d: string; readonly width: number; readonly opacity: number }[] = [
  { d: 'M14 38 C 16 24, 28 13, 42 10', width: 1.6, opacity: 1 },
  { d: 'M80 86 C 86 78, 90 68, 91 60', width: 1, opacity: 0.6 },
];
const CAUSTICS: readonly { readonly d: string; readonly width: number }[] = [
  { d: 'M22 70 C 34 63, 44 76, 56 68 S 74 62, 80 70', width: 0.7 },
  { d: 'M28 80 C 40 74, 52 86, 64 78 S 76 76, 78 80', width: 0.5 },
  { d: 'M34 60 C 44 56, 54 64, 66 58', width: 0.4 },
];
const SPARKS: readonly { readonly x: number; readonly y: number; readonly size: number }[] = [
  { x: 0.38, y: 0.7, size: 6 },
  { x: 0.6, y: 0.78, size: 5 },
  { x: 0.51, y: 0.64, size: 4 },
];

const useStyles = makeStyles((glass) => ({
  figure: { alignItems: 'center' },
  text: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  amount: {
    color: glass.colors.fg,
    fontFamily: 'Geist_300Light',
    fontWeight: '300',
    letterSpacing: -0.04 * glass.type.display.mobile,
  },
  unit: { color: glass.colors.dim, fontFamily: 'Geist_400Regular' },
  caption: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
  },
}));

export interface LensComponentProps extends LensProps {
  /** Small line under the number, for example "zł a day". */
  readonly unitLabel?: string;
}

/**
 * Safe-to-spend lens: money left is a glowing core inside glass (D7 R2.4 / R2.8). Skia draws the
 * glass, core, caustics, sparks and spec arcs; the number sits above the core in the upper 42 %
 * and the caption is outside the glass. `fraction` changes `settle` over 420 ms.
 */
export function Lens({ lens, unitLabel }: LensComponentProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const reducedMotion = useReducedMotion();
  const geometry = lensGeometry(lens.fraction);
  const diameter = LENS_SIZES[lens.size];
  const scale = diameter / REFERENCE_SIZE;
  const pad = BLOOM_PAD * scale;
  const canvasSize = diameter + 2 * pad;

  return (
    <View testID="lens" style={styles.figure}>
      <View
        testID="lens-frame"
        accessibilityRole="image"
        accessible
        accessibilityLabel={lens.ariaLabel}
        style={{ width: diameter, height: diameter }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ position: 'absolute', left: -pad, top: -pad }}
        >
          <Canvas style={{ width: canvasSize, height: canvasSize }}>
            <LensLight
              glass={glass}
              fraction={lens.fraction}
              hasCore={geometry.hasCore}
              diameter={diameter}
              pad={pad}
              scale={scale}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        </View>
        <LensText
          amountLabel={lens.amountLabel}
          unitLabel={unitLabel}
          diameter={diameter}
          scale={scale}
        />
      </View>
      <Text
        testID="lens-caption"
        style={[styles.caption, { marginTop: 12 * scale }]}
        maxFontSizeMultiplier={1.3}
      >
        {lens.caption}
      </Text>
    </View>
  );
}

interface LensLightProps {
  readonly glass: GlassRnTheme;
  readonly fraction: number;
  readonly hasCore: boolean;
  readonly diameter: number;
  readonly pad: number;
  readonly scale: number;
  readonly reducedMotion: boolean;
}

/** All Skia layers of the lens, in canvas coordinates. */
export function LensLight(props: LensLightProps): React.JSX.Element {
  const { glass, diameter, pad, scale, reducedMotion, hasCore, fraction } = props;
  const loops = useLoopsEnabled();
  const settled = useSettle(fraction, reducedMotion);
  const bloomPulse = useLoop(loops, { durationMs: BLOOM_MS, reverse: true });
  const bloomOpacity = useDerivedValue(() => 0.7 + 0.3 * bloomPulse.value);
  const bloomGlobal = useDerivedValue(() => 0.5 + 0.5 * Math.min(1, Math.max(0, settled.value)));
  const bloomAlpha = useDerivedValue(() => bloomOpacity.value * bloomGlobal.value);

  return (
    <>
      <LensBloom
        glass={glass}
        diameter={diameter}
        pad={pad}
        scale={scale}
        opacity={bloomAlpha}
        hasCore={hasCore}
      />
      <Group transform={[{ translateX: pad }, { translateY: pad }]}>
        <Group clip={rrect(rect(0, 0, diameter, diameter), diameter / 2, diameter / 2)}>
          <LensGlass glass={glass} diameter={diameter} />
          {hasCore ? (
            <LensCore
              glass={glass}
              diameter={diameter}
              scale={scale}
              settled={settled}
              loops={loops}
              reducedMotion={reducedMotion}
            />
          ) : null}
          <LensSpecular glass={glass} diameter={diameter} />
        </Group>
        <LensRim glass={glass} diameter={diameter} loops={loops} />
      </Group>
    </>
  );
}

interface BloomProps {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
  readonly pad: number;
  readonly scale: number;
  readonly opacity: SharedValue<number>;
  readonly hasCore: boolean;
}

function LensBloom({
  glass,
  diameter,
  pad,
  scale,
  opacity,
  hasCore,
}: BloomProps): React.JSX.Element | null {
  if (!hasCore) {
    return null;
  }

  return (
    <Oval
      x={pad - 60 * scale}
      y={pad + 20 * scale}
      width={diameter + 120 * scale}
      height={diameter + 50 * scale}
      color={glass.colors.bloomFar}
      opacity={opacity}
    >
      <BlurMask blur={32 * scale} style="normal" />
    </Oval>
  );
}

function LensGlass({
  glass,
  diameter,
}: {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
}): React.JSX.Element {
  const stops = parseGradientStops(glass.colors.lens);

  return (
    <Circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2}>
      <RadialGradient
        c={vec(0.34 * diameter, 0.26 * diameter)}
        r={0.99 * diameter}
        colors={stops.colors}
        positions={stops.positions}
      />
    </Circle>
  );
}

interface CoreProps {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
  readonly scale: number;
  readonly settled: SharedValue<number>;
  readonly loops: boolean;
  readonly reducedMotion: boolean;
}

/** Core, caustics and sparks: only drawn while there is money left. */
export function LensCore({
  glass,
  diameter,
  scale,
  settled,
  loops,
  reducedMotion,
}: CoreProps): React.JSX.Element {
  const core = parseGradientStops(glass.colors.core);
  const glowIn = useReveal(!reducedMotion, GLOWIN_MS, GLOWIN_DELAY_MS);
  const flicker = useLoop(loops, { durationMs: LENS_FLICKER_MS, delayMs: 1200, reverse: true });
  const caustic = useLoop(loops, { durationMs: CAUSTIC_MS, reverse: true });
  const radius = useDerivedValue(
    () => coreMetrics(settled.value).radius * diameter * (0.6 + 0.4 * glowIn.value),
  );
  const opacity = useDerivedValue(
    () => coreMetrics(settled.value).opacity * glowIn.value * flickerOpacity(flicker.value),
  );
  const drift = useDerivedValue(() => [
    { translateX: (-6 + 12 * caustic.value) * scale },
    { translateY: (2 - 4 * caustic.value) * scale },
  ]);
  const center = vec(diameter / 2, CORE_CENTER_Y * diameter);

  return (
    <>
      <Group opacity={opacity}>
        <Circle c={center} r={radius}>
          <RadialGradient c={center} r={radius} colors={core.colors} positions={core.positions} />
        </Circle>
      </Group>
      <Group transform={drift}>
        <Group transform={[{ scale: diameter / 100 }]}>
          {CAUSTICS.map((line) => (
            <Path
              key={line.d}
              path={line.d}
              style="stroke"
              strokeWidth={line.width}
              strokeCap="round"
              color={glass.colors.caustic}
            />
          ))}
        </Group>
      </Group>
      {SPARKS.map((spark, index) => (
        <LensSpark
          key={spark.x}
          glass={glass}
          diameter={diameter}
          spot={spark}
          loops={loops}
          index={index}
        />
      ))}
    </>
  );
}

interface SparkProps {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
  readonly spot: { readonly x: number; readonly y: number; readonly size: number };
  readonly loops: boolean;
  readonly index: number;
}

function LensSpark({ glass, diameter, spot, loops, index }: SparkProps): React.JSX.Element {
  const stops = parseGradientStops(glass.colors.spark);
  const twinkle = useLoop(loops, {
    durationMs: (TWINKLE_MS[index] ?? TWINKLE_MS[0] ?? 2800) / 2,
    delayMs: TWINKLE_DELAYS_MS[index] ?? 0,
    reverse: true,
    rest: 1,
  });
  const radius = useDerivedValue(
    () => spot.size * (0.4 + 0.6 * twinkle.value) * (diameter / REFERENCE_SIZE),
  );
  const center = vec(spot.x * diameter, spot.y * diameter);

  return (
    <Circle c={center} r={radius} opacity={twinkle}>
      <RadialGradient c={center} r={radius} colors={stops.colors} positions={stops.positions} />
    </Circle>
  );
}

function LensSpecular({
  glass,
  diameter,
}: {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
}): React.JSX.Element {
  return (
    <Group transform={[{ scale: diameter / 100 }]}>
      {SPECS.map((spec) => (
        <Path
          key={spec.d}
          path={spec.d}
          style="stroke"
          strokeWidth={spec.width}
          strokeCap="round"
          color={glass.colors.spec}
          opacity={spec.opacity}
        />
      ))}
    </Group>
  );
}

function LensRim({
  glass,
  diameter,
  loops,
}: {
  readonly glass: GlassRnTheme;
  readonly diameter: number;
  readonly loops: boolean;
}): React.JSX.Element {
  const irid = parseGradientStops(glass.colors.irid);
  const film = useLoop(loops, { durationMs: FILM_MS, reverse: true });
  const start = useDerivedValue(() => vec(-2 * diameter * film.value, 0));
  const end = useDerivedValue(() => vec(3 * diameter - 2 * diameter * film.value, diameter));

  return (
    <>
      <Circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={diameter / 2 - 0.5}
        style="stroke"
        strokeWidth={1}
        color={firstColor(glass.colors.lensRim)}
      />
      <Circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={diameter / 2 - 1.5}
        style="stroke"
        strokeWidth={1}
      >
        <LinearGradient start={start} end={end} colors={irid.colors} positions={irid.positions} />
      </Circle>
    </>
  );
}

interface LensTextProps {
  readonly amountLabel: string;
  readonly unitLabel: string | undefined;
  readonly diameter: number;
  readonly scale: number;
}

/** The number lives in the upper 42 % of the lens (top 11 %, height 31 %), above the core. */
function LensText({ amountLabel, unitLabel, diameter, scale }: LensTextProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const amountSize = glass.type.display.mobile * scale;

  return (
    <View
      testID="lens-text"
      pointerEvents="none"
      style={[styles.text, { top: 0.11 * diameter, height: 0.31 * diameter }]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.amount, { fontSize: amountSize, lineHeight: amountSize * 0.87 }]}
      >
        {amountLabel}
      </Text>
      {unitLabel === undefined ? null : (
        <Text
          allowFontScaling={false}
          style={[styles.unit, { fontSize: Math.max(10, 16 * scale), lineHeight: 16 * scale }]}
        >
          {unitLabel}
        </Text>
      )}
    </View>
  );
}
