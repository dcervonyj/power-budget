import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ButtonVariant } from '@power-budget/shared-app';
import { makeStyles, useGlass } from '../theme/index.js';
import { LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly children: string;
}

const useStyles = makeStyles((glass) => ({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: glass.space.lg,
    borderRadius: glass.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: glass.space.xs,
  },
  primary: {
    backgroundColor: glass.colors.lightSolid,
    boxShadow: `inset 0 0 0 1px ${glass.colors.lightEdge}`,
  },
  clear: { backgroundColor: glass.colors.clear, boxShadow: glass.colors.clearRim },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  text: { fontFamily: LABEL_FONT, fontSize: glass.type.label.mobile },
  textPrimary: { color: glass.colors.accentInk },
  textSecondary: { color: glass.colors.fg },
  textDanger: { color: glass.colors.over },
}));

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  children,
}: ButtonProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const isDisabled = disabled || loading;
  const textStyle =
    variant === 'primary'
      ? styles.textPrimary
      : variant === 'danger'
        ? styles.textDanger
        : styles.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: isDisabled }}
      aria-busy={loading}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.clear,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {variant === 'danger' && <DangerGlyph color={glass.colors.over} />}
      {loading ? (
        <ActivityIndicator
          size="small"
          accessibilityLabel={children}
          color={variant === 'primary' ? glass.colors.accentInk : glass.colors.fg}
        />
      ) : (
        <Text style={[styles.text, textStyle]}>{children}</Text>
      )}
    </Pressable>
  );
}

function DangerGlyph({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 2 1.5 13.5h13L8 2ZM8 6.5v3M8 11.6v.01"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
