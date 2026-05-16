import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { biometricUnlockService } from '../../infrastructure/index.js';

const t = rnDarkTheme;

interface Props {
  readonly visible: boolean;
  readonly onSuccess: () => void;
}

export function BiometricPromptOverlay({ visible, onSuccess }: Props): React.JSX.Element {
  const intl = useIntl();
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const triggerAuth = async (): Promise<void> => {
    setAuthenticating(true);
    setFailed(false);
    try {
      const success = await biometricUnlockService.authenticate(
        intl.formatMessage({
          id: 'biometric.promptMessage',
          defaultMessage: 'Unlock Power Budget',
        }),
      );
      if (success) {
        onSuccess();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void triggerAuth();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            <FormattedMessage id="biometric.title" defaultMessage="Unlock App" />
          </Text>
          <Text style={styles.body}>
            <FormattedMessage id="biometric.body" defaultMessage="Authenticate to continue." />
          </Text>

          {authenticating ? (
            <ActivityIndicator size="large" color={t.colorAccentDefault} style={styles.spinner} />
          ) : (
            <>
              {failed && (
                <Text style={styles.errorText}>
                  <FormattedMessage
                    id="biometric.failed"
                    defaultMessage="Authentication failed. Try again."
                  />
                </Text>
              )}
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  void triggerAuth();
                }}
              >
                <Text style={styles.buttonText}>
                  <FormattedMessage
                    id="biometric.retry"
                    defaultMessage="Use Biometrics / Passcode"
                  />
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: t.spaceLg,
  },
  card: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusLg,
    padding: t.spaceLg,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: t.fontSizeXl,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.spaceSm,
    textAlign: 'center',
  },
  body: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeMd,
    textAlign: 'center',
    marginBottom: t.spaceLg,
  },
  spinner: {
    marginTop: t.spaceMd,
  },
  errorText: {
    color: t.colorStatusDanger,
    fontSize: t.fontSizeSm,
    marginBottom: t.spaceMd,
    textAlign: 'center',
  },
  button: {
    backgroundColor: t.colorAccentDefault,
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceLg,
    borderRadius: t.radiusMd,
  },
  buttonText: {
    color: t.colorAccentOnAccent,
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightMedium,
  },
});
