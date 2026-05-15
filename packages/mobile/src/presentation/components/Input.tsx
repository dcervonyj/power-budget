import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { FormattedMessage } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const t = rnDarkTheme;

export interface InputProps {
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly secureTextEntry?: boolean;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly keyboardType?: 'default' | 'email-address' | 'numeric';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Input({
  label,
  placeholder,
  error,
  secureTextEntry = false,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: InputProps): React.JSX.Element {
  const [showText, setShowText] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error ? styles.inputError : styles.inputDefault]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colorTextMuted}
          secureTextEntry={secureTextEntry && !showText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => {
              setShowText((s) => !s);
            }}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {showText ? (
                <FormattedMessage id="input.password.hide" defaultMessage="Hide" />
              ) : (
                <FormattedMessage id="input.password.show" defaultMessage="Show" />
              )}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: t.spaceMd },
  label: { color: t.colorTextSecondary, fontSize: t.fontSizeSm, marginBottom: t.spaceXs },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusSm,
    borderWidth: 1,
    paddingHorizontal: t.spaceMd,
  },
  inputDefault: { borderColor: t.colorBorderSubtle },
  inputError: { borderColor: t.colorStatusDanger },
  input: {
    flex: 1,
    color: t.colorTextPrimary,
    fontSize: t.fontSizeMd,
    paddingVertical: t.spaceSm,
  },
  toggle: { paddingLeft: t.spaceSm },
  toggleText: { color: t.colorTextSecondary, fontSize: t.fontSizeSm },
  error: { color: t.colorStatusDanger, fontSize: t.fontSizeXs, marginTop: t.spaceXs },
});
