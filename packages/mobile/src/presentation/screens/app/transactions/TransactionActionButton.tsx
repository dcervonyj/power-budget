import React from 'react';
import { Pressable, Text } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { LABEL_FONT, TOUCH_TARGET } from '../../../glass/controls/fonts.js';

export interface TransactionActionButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly disabled?: boolean;
  /** A request is on its way: the button is disabled and says so to a screen reader. */
  readonly busy?: boolean;
}

const useStyles = makeStyles((glass) => ({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: glass.space.lg,
    borderRadius: glass.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.fill2,
    boxShadow: glass.colors.clearRim,
  },
  primary: {
    backgroundColor: glass.colors.lightSolid,
    boxShadow: `inset 0 0 0 1px ${glass.colors.lightEdge}`,
  },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }] },
  text: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.label.mobile },
  textPrimary: {
    color: glass.colors.accentInk,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.label.mobile,
  },
}));

/** Glass button of the transaction screens: light when primary, clear otherwise. */
export function TransactionActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  busy = false,
}: TransactionActionButtonProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary && styles.primary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={primary ? styles.textPrimary : styles.text}>{label}</Text>
    </Pressable>
  );
}
