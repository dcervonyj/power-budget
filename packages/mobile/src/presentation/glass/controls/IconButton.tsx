import React from 'react';
import { Pressable } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { TOUCH_TARGET } from './fonts.js';

export interface IconButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

const useStyles = makeStyles((glass) => ({
  base: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
}));

/** Round clear-glass button for an icon; `label` is its accessible name. */
export function IconButton({
  label,
  onPress,
  disabled = false,
  children,
}: IconButtonProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}
