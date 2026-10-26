import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import type { GlassDepth, GlassMaterial } from '@power-budget/shared-app';
import { useGlass } from '../../theme/index.js';
import { DecorLayer, Film, Specular, Sweep } from './GlassDecor.js';
import type { Size, SweepSlot } from './GlassDecor.js';
import { materialFill, materialShadows } from './materialStyle.js';
import { useRiseStyle } from './motion.js';

export type { GlassDepth, GlassMaterial };
export type { SweepSlot };

export interface GlassDecorOptions {
  readonly specular?: boolean;
  readonly film?: boolean;
  readonly sweep?: SweepSlot;
}

export interface GlassPanelProps {
  readonly material?: GlassMaterial;
  readonly depth?: GlassDepth;
  readonly decor?: GlassDecorOptions;
  /** Entrance index: the panel rises with a stagger of `index` steps. Omit for no entrance. */
  readonly rise?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Style of the content layer, which sits above the decor. */
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly children?: React.ReactNode;
}

const ANDROID_BLUR_MIN_API = 31;

/**
 * D7 panel. frosted = BlurView + g0/g1/g2 tint (one BlurView per panel; rows inside it are clear),
 * clear = tint-free View with a rim, tinted = BlurView + tint. Decor is hidden from screen readers.
 */
export function GlassPanel({
  material = 'frosted',
  depth = 1,
  decor = {},
  rise,
  radius,
  style,
  contentStyle,
  children,
}: GlassPanelProps): React.JSX.Element {
  const glass = useGlass();
  const riseStyle = useRiseStyle(rise);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const cornerRadius = radius ?? glass.radius.mobilePanel;
  const shadows = materialShadows(glass.colors, material, depth);
  const measured = size.width > 0 && size.height > 0;
  const clipStyle = [
    StyleSheet.absoluteFill,
    { borderRadius: cornerRadius, overflow: 'hidden' },
  ] as const;

  return (
    <Animated.View
      testID="glass-panel"
      onLayout={(event: LayoutChangeEvent) => {
        setSize(event.nativeEvent.layout);
      }}
      style={[
        { borderRadius: cornerRadius, boxShadow: shadows.outer === '' ? undefined : shadows.outer },
        style,
        riseStyle,
      ]}
    >
      <DecorLayer name="backdrop">
        <View style={clipStyle}>
          <Backdrop material={material} depth={depth} />
          {measured && decor.specular === true ? (
            <Specular size={size} radius={cornerRadius} />
          ) : null}
          {measured && decor.film === true ? <Film size={size} radius={cornerRadius} /> : null}
          {measured && decor.sweep !== undefined ? <Sweep size={size} slot={decor.sweep} /> : null}
        </View>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: cornerRadius,
              boxShadow: shadows.inset === '' ? undefined : shadows.inset,
            },
          ]}
        />
      </DecorLayer>
      <View style={contentStyle}>{children}</View>
    </Animated.View>
  );
}

function Backdrop({
  material,
  depth,
}: {
  material: GlassMaterial;
  depth: GlassDepth;
}): React.JSX.Element {
  const glass = useGlass();
  const fill = materialFill(glass.colors, material, depth);

  return (
    <>
      {material !== 'clear' && supportsBlur() ? (
        <BlurView
          testID="glass-blur"
          intensity={glass.blur.rnIntensity}
          tint={glass.colors.name === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
    </>
  );
}

/** Android below API 31 has no usable blur: the tint alone carries the material there. */
function supportsBlur(): boolean {
  return Platform.OS !== 'android' || Number(Platform.Version) >= ANDROID_BLUR_MIN_API;
}
