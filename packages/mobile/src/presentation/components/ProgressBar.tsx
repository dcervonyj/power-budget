import React from 'react';
import { View, StyleSheet } from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const t = rnDarkTheme;

export type ProgressBand = 'green' | 'amber' | 'red';

function getBand(ratio: number): ProgressBand {
  if (ratio > 1) return 'red';
  if (ratio > 0.8) return 'amber';
  return 'green';
}

interface ProgressBarProps {
  readonly ratio: number;
  readonly band?: ProgressBand;
}

export function ProgressBar({ ratio, band }: ProgressBarProps): React.JSX.Element {
  const resolvedBand = band ?? getBand(ratio);
  const fillColor =
    resolvedBand === 'red'
      ? t.colorStatusDanger
      : resolvedBand === 'amber'
        ? t.colorStatusWarning
        : t.colorStatusSuccess;
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          {
            width: `${(clampedRatio * 100).toFixed(1)}%` as `${number}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.colorBorderSubtle,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
