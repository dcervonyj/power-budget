import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useIntl } from 'react-intl';
import { makeStyles, useGlass } from '../theme/index.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

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

const useStyles = makeStyles((glass) => ({
  container: { marginBottom: glass.space.md },
  label: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
    marginBottom: glass.space.xxs,
  },
  wrapper: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.colors.clear,
    borderRadius: glass.radius.control,
    borderWidth: 1,
    paddingHorizontal: glass.space.md,
  },
  wrapperDefault: { borderColor: glass.colors.sep },
  wrapperFocused: { borderColor: glass.colors.accent },
  wrapperError: { borderColor: glass.colors.over },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
  },
  toggle: { minHeight: TOUCH_TARGET, paddingLeft: glass.space.xs, justifyContent: 'center' },
  toggleText: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
  error: {
    color: glass.colors.over,
    fontFamily: BODY_FONT,
    fontSize: glass.type.small.mobile,
    marginTop: glass.space.xxs,
  },
}));

// RN 0.88 has no aria-describedby/aria-invalid (AccessibilityState has no `invalid`;
// accessibilityLabelledBy is Android-only), so the error rides on accessibilityHint, which
// VoiceOver and TalkBack both read after the field. The visible error text is not a separate
// focus stop (accessible=false) but stays a live region so it is announced when it appears.
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
  const styles = useStyles();
  const glass = useGlass();
  const intl = useIntl();
  const [showText, setShowText] = useState(false);
  const [focused, setFocused] = useState(false);
  const toggleLabel = showText
    ? intl.formatMessage({ id: 'input.password.hide', defaultMessage: 'Hide' })
    : intl.formatMessage({ id: 'input.password.show', defaultMessage: 'Show' });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.wrapper,
          error ? styles.wrapperError : focused ? styles.wrapperFocused : styles.wrapperDefault,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholder={placeholder}
          placeholderTextColor={glass.colors.faint}
          accessibilityLabel={label ?? placeholder}
          accessibilityHint={error}
          secureTextEntry={secureTextEntry && !showText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            onPress={() => {
              setShowText((s) => !s);
            }}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{toggleLabel}</Text>
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          accessible={false}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
