import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
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
      const result = await authService.login({
        email,
        password,
        ...(showTotp && totpCode ? { totpCode } : {}),
      });

      if (result.requiresTotp) {
        setShowTotp(true);
      }
      // Navigation to App stack happens when auth state is updated in RootNavigator
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.loginFailed',
          defaultMessage: 'Login failed. Please check your credentials.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        <FormattedMessage id="screen.login.title" defaultMessage="Sign In" />
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

      {showTotp && (
        <Input
          label={intl.formatMessage({ id: 'field.totpCode', defaultMessage: '2FA Code' })}
          value={totpCode}
          onChangeText={setTotpCode}
          keyboardType="numeric"
          placeholder={intl.formatMessage({
            id: 'field.totpCode.placeholder',
            defaultMessage: '000000',
          })}
        />
      )}

      <Button
        variant="primary"
        onPress={() => {
          void handleLogin();
        }}
        loading={loading}
      >
        {intl.formatMessage({ id: 'action.signIn', defaultMessage: 'Sign In' })}
      </Button>

      <View style={styles.links}>
        <Button
          variant="secondary"
          onPress={() => {
            navigation.navigate('MagicLink');
          }}
        >
          {intl.formatMessage({ id: 'action.forgotPassword', defaultMessage: 'Forgot password?' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            navigation.navigate('Register');
          }}
        >
          {intl.formatMessage({ id: 'action.signUp', defaultMessage: 'Sign up' })}
        </Button>
      </View>
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
  links: {
    marginTop: t.spaceLg,
    gap: t.spaceSm,
  },
});
