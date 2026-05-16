import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { Button } from './Button.js';
import { biometricUnlockService } from '../../infrastructure/index.js';

const t = rnDarkTheme;

interface Props {
  readonly onDone: () => void;
}

/** Shown once on first launch when biometrics are available. */
export function BiometricOptInPrompt({ onDone }: Props): React.JSX.Element {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);

  const handleEnable = async (): Promise<void> => {
    setLoading(true);
    try {
      const success = await biometricUnlockService.authenticate(
        intl.formatMessage({
          id: 'biometric.optIn.promptMessage',
          defaultMessage: 'Verify to enable biometric unlock',
        }),
      );
      if (success) {
        await biometricUnlockService.setBiometricEnabled(true);
        onDone();
      } else {
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'biometric.optIn.authFailed',
            defaultMessage: 'Authentication failed. Biometric unlock was not enabled.',
          }),
        );
        onDone();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    await biometricUnlockService.setBiometricEnabled(false);
    onDone();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        <FormattedMessage id="biometric.optIn.title" defaultMessage="Enable Biometric Unlock" />
      </Text>
      <Text style={styles.body}>
        <FormattedMessage
          id="biometric.optIn.body"
          defaultMessage="Unlock Power Budget quickly and securely with Face ID or Touch ID."
        />
      </Text>

      <Button
        variant="primary"
        onPress={() => {
          void handleEnable();
        }}
        loading={loading}
      >
        {intl.formatMessage({ id: 'biometric.optIn.enable', defaultMessage: 'Enable' })}
      </Button>

      <View style={styles.spacer} />

      <Button
        variant="secondary"
        onPress={() => {
          void handleSkip();
        }}
        disabled={loading}
      >
        {intl.formatMessage({ id: 'biometric.optIn.skip', defaultMessage: 'Not Now' })}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: t.spaceLg,
    backgroundColor: t.colorSurfaceBase,
  },
  title: {
    fontSize: t.fontSizeXl,
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
  spacer: {
    height: t.spaceSm,
  },
});
