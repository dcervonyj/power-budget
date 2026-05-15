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

type Props = NativeStackScreenProps<AuthStackParamList, 'MagicLink'>;

export function MagicLinkScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async (): Promise<void> => {
    if (!email) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({ id: 'error.emailRequired', defaultMessage: 'Email is required.' }),
      );
      return;
    }

    setLoading(true);
    try {
      await authService.requestMagicLink(email);
      setSent(true);
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.magicLinkFailed',
          defaultMessage: 'Could not send magic link. Please try again.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          <FormattedMessage id="screen.magicLink.sent.title" defaultMessage="Check your email" />
        </Text>
        <Text style={styles.body}>
          <FormattedMessage
            id="screen.magicLink.sent.body"
            defaultMessage="We sent a sign-in link to {email}."
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
        <FormattedMessage id="screen.magicLink.title" defaultMessage="Sign in with Magic Link" />
      </Text>
      <Text style={styles.body}>
        <FormattedMessage
          id="screen.magicLink.description"
          defaultMessage="Enter your email and we'll send you a sign-in link."
        />
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

      <Button
        variant="primary"
        onPress={() => {
          void handleRequest();
        }}
        loading={loading}
      >
        {intl.formatMessage({ id: 'action.sendMagicLink', defaultMessage: 'Send Magic Link' })}
      </Button>

      <Button
        variant="secondary"
        onPress={() => {
          navigation.navigate('Login');
        }}
      >
        {intl.formatMessage({ id: 'action.backToSignIn', defaultMessage: 'Back to Sign In' })}
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
    marginBottom: t.spaceMd,
    textAlign: 'center',
  },
  body: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeMd,
    textAlign: 'center',
    marginBottom: t.spaceLg,
  },
});
