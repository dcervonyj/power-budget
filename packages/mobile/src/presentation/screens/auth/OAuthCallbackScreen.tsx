import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AuthStackParamList, 'OAuthCallback'>;

export function OAuthCallbackScreen({ route, navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const { code, state } = route.params;

  useEffect(() => {
    if (!code) {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.oauthFailed',
          defaultMessage: 'Sign in with Google failed. Please try again.',
        }),
      );
      navigation.navigate('Login');
      return;
    }

    void authService
      .handleOAuthCallback(code, state)
      .then(() => {
        navigation.navigate('Login');
      })
      .catch(() => {
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.oauthFailed',
            defaultMessage: 'Sign in with Google failed. Please try again.',
          }),
        );
        navigation.navigate('Login');
      });
  }, [code, state]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={t.colorAccentDefault} />
      <Text style={styles.text}>
        <FormattedMessage
          id="screen.oauthCallback.loading"
          defaultMessage="Completing sign in…"
        />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colorSurfaceBase,
    gap: t.spaceMd,
  },
  text: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeMd,
  },
});
