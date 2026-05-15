import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { SelectOption } from '@power-budget/shared-app';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Locale = 'en' | 'uk' | 'ru' | 'pl';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const LOCALE_OPTIONS: ReadonlyArray<SelectOption<Locale>> = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'pl', label: 'Polski' },
];

export function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({
          id: 'error.emailPasswordRequired',
          defaultMessage: 'Email and password are required.',
        }),
      );
      return;
    }

    setLoading(true);
    try {
      await authService.register({ email, password, locale });
      setSuccess(true);
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.registerFailed',
          defaultMessage: 'Registration failed. Email may already be in use.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          <FormattedMessage id="screen.register.success.title" defaultMessage="Check your email" />
        </Text>
        <Text style={styles.body}>
          <FormattedMessage
            id="screen.register.success.body"
            defaultMessage="We sent a confirmation link to {email}."
            values={{ email }}
          />
        </Text>
        <Button
          variant="secondary"
          onPress={() => {
            navigation.navigate('Login');
          }}
        >
          {intl.formatMessage({ id: 'action.backToSignIn', defaultMessage: 'Back to Sign In' })}
        </Button>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        <FormattedMessage id="screen.register.title" defaultMessage="Create Account" />
      </Text>

      <Input
        label={intl.formatMessage({ id: 'field.email', defaultMessage: 'Email' })}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder={intl.formatMessage({
          id: 'field.email.placeholder',
          defaultMessage: 'you@example.com',
        })}
      />

      <Input
        label={intl.formatMessage({ id: 'field.password', defaultMessage: 'Password' })}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={intl.formatMessage({
          id: 'field.password.placeholder',
          defaultMessage: '••••••••',
        })}
      />

      <Select<Locale>
        label={intl.formatMessage({ id: 'field.locale', defaultMessage: 'Language' })}
        options={LOCALE_OPTIONS}
        value={locale}
        onChange={setLocale}
      />

      <Button
        variant="primary"
        onPress={() => {
          void handleRegister();
        }}
        loading={loading}
      >
        {intl.formatMessage({ id: 'action.createAccount', defaultMessage: 'Create Account' })}
      </Button>

      <Button
        variant="secondary"
        onPress={() => {
          navigation.navigate('Login');
        }}
      >
        {intl.formatMessage({ id: 'action.signIn', defaultMessage: 'Sign In' })}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: t.spaceLg,
    justifyContent: 'center',
    backgroundColor: t.colorSurfaceBase,
  },
  title: {
    fontSize: t.fontSize2xl,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.space2xl,
    textAlign: 'center',
  },
  body: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeMd,
    textAlign: 'center',
    marginBottom: t.spaceLg,
  },
});
