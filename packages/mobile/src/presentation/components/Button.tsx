import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { ButtonVariant } from '@power-budget/shared-app';

const t = rnDarkTheme;

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly children: string;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  children,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? t.colorAccentDefault
      : variant === 'danger'
        ? t.colorStatusDanger
        : 'transparent';

  const textColor = variant === 'primary' ? t.colorAccentOnAccent : t.colorTextPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bgColor, borderRadius: t.radiusMd, opacity: isDisabled ? 0.5 : 1 },
        variant === 'secondary' && styles.secondaryBorder,
      ]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize: t.fontSizeMd }]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: t.colorBorderStrong,
  },
  text: {
    fontWeight: t.fontWeightMedium,
  },
});
