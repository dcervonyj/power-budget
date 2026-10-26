import React from 'react';
import { Text, View } from 'react-native';
import type { GlassColors, GlassTheme } from '@power-budget/design-tokens/glass';
import { makeStyles, useGlass } from '../presentation/theme/index.js';

const SWATCHES: readonly (keyof GlassColors)[] = [
  'base',
  'fg',
  'dim',
  'faint',
  'g0',
  'g1',
  'g2',
  'edge',
  'accent',
  'accentInk',
  'lightSolid',
  'ok',
  'over',
];

const TYPE_STEPS: readonly (keyof GlassTheme['type'])[] = [
  'display',
  'hero',
  'figure',
  'title',
  'amount',
  'heading',
  'panelLabel',
  'label',
  'body',
  'small',
  'tag',
];

const useStyles = makeStyles((glass) => ({
  heading: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.heading.mobile,
    marginVertical: glass.space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: glass.space.md },
  swatch: { width: 100 },
  chip: {
    height: 56,
    borderRadius: glass.radius.control,
    borderWidth: 1,
    borderColor: glass.colors.sep,
  },
  label: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
  },
  step: { color: glass.colors.fg, marginBottom: glass.space.sm },
}));

/** Colour tokens of the active theme. */
export function Swatches(): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <View accessibilityLabel="Token swatches">
      <Text accessibilityRole="header" style={styles.heading}>
        Token swatches
      </Text>
      <View style={styles.grid}>
        {SWATCHES.map((name) => (
          <View key={name} style={styles.swatch}>
            <View style={[styles.chip, { backgroundColor: glass.colors[name] }]} />
            <Text style={styles.label}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The D7 type scale at mobile sizes. */
export function TypeScale(): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <View accessibilityLabel="Type scale">
      <Text accessibilityRole="header" style={styles.heading}>
        Type scale
      </Text>
      {TYPE_STEPS.map((name) => (
        <Text
          key={name}
          style={[
            styles.step,
            { fontFamily: fontFor(glass.type[name].weight), fontSize: glass.type[name].mobile },
          ]}
        >
          {name}
        </Text>
      ))}
    </View>
  );
}

function fontFor(weight: number | undefined): string {
  if (weight === undefined || weight === 400) {
    return 'Geist_400Regular';
  }

  return weight === 300
    ? 'Geist_300Light'
    : weight === 500
      ? 'Geist_500Medium'
      : 'Geist_600SemiBold';
}
