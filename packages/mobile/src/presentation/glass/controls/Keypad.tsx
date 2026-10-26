import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { makeStyles, useGlass } from '../../theme/index.js';
import { BODY_FONT, LABEL_FONT } from './fonts.js';
import { applyKeypadKey } from './keypadInput.js';
import type { KeypadKey } from './keypadInput.js';

export interface KeypadProps {
  /** Amount typed so far, dot-separated ("" | "12" | "12.5"). */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly submitLabel: string;
  readonly backspaceLabel: string;
  /** Symbol shown on the decimal key; the value itself always uses a dot. */
  readonly decimalSeparator?: string;
  readonly disabled?: boolean;
}

const ROWS: ReadonlyArray<ReadonlyArray<KeypadKey>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

const KEY_HEIGHT = 56;

const useStyles = makeStyles((glass) => ({
  pad: { gap: glass.space.xs },
  row: { flexDirection: 'row', gap: glass.space.xs },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    borderRadius: glass.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  keyText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.title.mobile,
  },
  submit: {
    height: KEY_HEIGHT,
    borderRadius: glass.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.lightSolid,
    boxShadow: `inset 0 0 0 1px ${glass.colors.lightEdge}`,
  },
  submitText: {
    color: glass.colors.accentInk,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.label.mobile,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
}));

/**
 * Numeric amount pad. It is plain focusable Pressables with no TextInput, so a hardware
 * keyboard never fights it (Tab moves between keys, Enter / Space press) and the soft
 * keyboard never opens.
 */
export function Keypad({
  value,
  onChange,
  onSubmit,
  submitLabel,
  backspaceLabel,
  decimalSeparator = '.',
  disabled = false,
}: KeypadProps): React.JSX.Element {
  const styles = useStyles();
  const submitDisabled = disabled || value === '';

  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={keyLabel(key, backspaceLabel, decimalSeparator)}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => {
                onChange(applyKeypadKey(value, key));
              }}
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}
            >
              {key === 'backspace' ? (
                <BackspaceGlyph />
              ) : (
                <Text importantForAccessibility="no" style={styles.keyText}>
                  {key === '.' ? decimalSeparator : key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: submitDisabled }}
        disabled={submitDisabled}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.submit,
          pressed && styles.pressed,
          submitDisabled && styles.disabled,
        ]}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function keyLabel(key: KeypadKey, backspaceLabel: string, decimalSeparator: string): string {
  if (key === 'backspace') {
    return backspaceLabel;
  }

  return key === '.' ? decimalSeparator : key;
}

function BackspaceGlyph(): React.JSX.Element {
  const glass = useGlass();

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5h11v14H9L3 12l6-7ZM12 9l5 6M17 9l-5 6"
        stroke={glass.colors.fg}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
