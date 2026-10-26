import React from 'react';
import { Text, View } from 'react-native';
import type { AccessibilityActionEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { makeStyles, useGlass } from '../../theme/index.js';
import { BODY_FONT, TOUCH_TARGET } from './fonts.js';
import { IconButton } from './IconButton.js';

export interface StepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly label: string;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly formatValue?: (value: number) => string;
}

const ACTIONS = [{ name: 'increment' as const }, { name: 'decrement' as const }];

const useStyles = makeStyles((glass) => ({
  group: { flexDirection: 'row', alignItems: 'center', gap: glass.space.xs },
  value: {
    minWidth: 56,
    paddingHorizontal: glass.space.sm,
    height: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.amount.mobile,
    fontVariant: ['tabular-nums'],
  },
}));

export function Stepper({
  value,
  onChange,
  label,
  decrementLabel,
  incrementLabel,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
  formatValue = String,
}: StepperProps): React.JSX.Element {
  const styles = useStyles();
  const text = formatValue(value);

  function commit(next: number): void {
    const clamped = Math.min(max, Math.max(min, next));
    if (!disabled && clamped !== value) {
      onChange(clamped);
    }
  }

  function handleAction(event: AccessibilityActionEvent): void {
    commit(event.nativeEvent.actionName === 'increment' ? value + step : value - step);
  }

  return (
    <View accessibilityRole="none" style={styles.group}>
      <IconButton
        label={decrementLabel}
        disabled={disabled || value <= min}
        onPress={() => {
          commit(value - step);
        }}
      >
        <Glyph plus={false} />
      </IconButton>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-disabled={disabled}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={handleAction}
        style={styles.value}
      >
        <Text style={styles.valueText}>{text}</Text>
      </View>
      <IconButton
        label={incrementLabel}
        disabled={disabled || value >= max}
        onPress={() => {
          commit(value + step);
        }}
      >
        <Glyph plus />
      </IconButton>
    </View>
  );
}

function Glyph({ plus }: { readonly plus: boolean }): React.JSX.Element {
  const glass = useGlass();

  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d={plus ? 'M3 8h10M8 3v10' : 'M3 8h10'}
        stroke={glass.colors.fg}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
