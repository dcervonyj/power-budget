import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text, Image } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AuthStackParamList, 'TotpEnrollment'>;

export function TotpEnrollmentScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);

  useEffect(() => {
    void authService
      .enableTotp()
      .then(({ qrCodeUri: uri, recoveryCodes: codes }) => {
        setQrCodeUri(uri);
        setRecoveryCodes(codes);
        setEnrolling(false);
      })
      .catch(() => {
        setEnrolling(false);
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.totpSetupFailed',
            defaultMessage: 'Could not set up 2FA. Please try again.',
          }),
        );
      });
  }, []);

  const handleVerify = async (): Promise<void> => {
    if (!code || code.length !== 6) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({
          id: 'error.totpCodeInvalid',
          defaultMessage: 'Please enter the 6-digit code.',
        }),
      );
      return;
    }

    setLoading(true);
    try {
      await authService.verifyTotp(code);
      navigation.navigate('Login');
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.totpCodeWrong',
          defaultMessage: 'Invalid code. Please try again.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  if (enrolling) {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>
          <FormattedMessage id="screen.totp.loading" defaultMessage="Setting up 2FA…" />
        </Text>
      </View>
    );
  }

  const qrImageUri =
    qrCodeUri !== null
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUri)}`
      : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        <FormattedMessage
          id="screen.totp.title"
          defaultMessage="Set up Two-Factor Authentication"
        />
      </Text>

      <Text style={styles.body}>
        <FormattedMessage
          id="screen.totp.instruction"
          defaultMessage="Scan this QR code with your authenticator app."
        />
      </Text>

      {qrImageUri !== null && (
        <View style={styles.qrContainer}>
          <Image
            source={{ uri: qrImageUri }}
            style={styles.qrCode}
            accessibilityLabel={intl.formatMessage({
              id: 'screen.totp.qrAlt',
              defaultMessage: 'QR Code',
            })}
          />
        </View>
      )}

      {recoveryCodes.length > 0 && (
        <View style={styles.codesContainer}>
          <Text style={styles.codesTitle}>
            <FormattedMessage id="screen.totp.recoveryCodes" defaultMessage="Recovery Codes" />
          </Text>
          {recoveryCodes.map((rc) => (
            <Text key={rc} style={styles.code}>
              {rc}
            </Text>
          ))}
        </View>
      )}

      <Input
        label={intl.formatMessage({ id: 'field.totpCode', defaultMessage: '2FA Code' })}
        value={code}
        onChangeText={setCode}
        keyboardType="numeric"
        placeholder={intl.formatMessage({
          id: 'field.totpCode.placeholder',
          defaultMessage: '000000',
        })}
      />

      <Button
        variant="primary"
        onPress={() => {
          void handleVerify();
        }}
        loading={loading}
      >
        {intl.formatMessage({ id: 'action.verifyCode', defaultMessage: 'Verify Code' })}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  qrContainer: {
    alignItems: 'center',
    marginBottom: t.spaceLg,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  codesContainer: {
    backgroundColor: t.colorSurfaceMid,
    padding: t.spaceMd,
    borderRadius: t.radiusMd,
    marginBottom: t.spaceLg,
  },
  codesTitle: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeSm,
    marginBottom: t.spaceSm,
  },
  code: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeSm,
    fontFamily: 'monospace',
  },
});
