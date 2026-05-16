import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text, Linking, TouchableOpacity } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AuthStackParamList, 'TotpEnrollment'>;

type Phase = 'loading' | 'qr' | 'recovery';

/** Extract the secret key from an otpauth:// URI */
function extractSecret(otpauthUri: string): string {
  try {
    const url = new URL(otpauthUri);
    return url.searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

export function TotpEnrollmentScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [qrCodeUri, setQrCodeUri] = useState<string>('');
  const [manualEntryKey, setManualEntryKey] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    void authService
      .enableTotp()
      .then(({ qrCodeUri: uri, recoveryCodes: codes }) => {
        setQrCodeUri(uri);
        setManualEntryKey(extractSecret(uri));
        setRecoveryCodes(codes);
        setPhase('qr');
      })
      .catch(() => {
        setPhase('qr');
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.totpSetupFailed',
            defaultMessage: 'Could not set up 2FA. Please try again.',
          }),
        );
      });
  }, []);

  const handleOpenInAuthenticator = (): void => {
    if (!qrCodeUri) return;
    void Linking.openURL(qrCodeUri).catch(() => {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.noAuthenticatorApp',
          defaultMessage: 'No authenticator app found. Install one from the App Store.',
        }),
      );
    });
  };

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
      setPhase('recovery');
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

  const handleCopyAll = async (): Promise<void> => {
    await Clipboard.setStringAsync(recoveryCodes.join('\n'));
    Alert.alert(
      intl.formatMessage({ id: 'action.copied', defaultMessage: 'Copied' }),
      intl.formatMessage({
        id: 'screen.totp.recoveryCodesCopied',
        defaultMessage: 'Recovery codes copied to clipboard.',
      }),
    );
  };

  const handleShare = async (): Promise<void> => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      await Clipboard.setStringAsync(recoveryCodes.join('\n'));
      Alert.alert(
        intl.formatMessage({ id: 'action.copied', defaultMessage: 'Copied' }),
        intl.formatMessage({
          id: 'screen.totp.recoveryCodesCopied',
          defaultMessage: 'Recovery codes copied to clipboard.',
        }),
      );
      return;
    }
    // expo-sharing requires a file; copy to clipboard as fallback for text
    await Clipboard.setStringAsync(recoveryCodes.join('\n'));
    Alert.alert(
      intl.formatMessage({ id: 'action.copied', defaultMessage: 'Copied' }),
      intl.formatMessage({
        id: 'screen.totp.recoveryCodesCopied',
        defaultMessage: 'Recovery codes copied to clipboard.',
      }),
    );
  };

  if (phase === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.body}>
          <FormattedMessage id="screen.totp.loading" defaultMessage="Setting up 2FA…" />
        </Text>
      </View>
    );
  }

  if (phase === 'recovery') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          <FormattedMessage id="screen.totp.recovery.title" defaultMessage="Recovery Codes" />
        </Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            <FormattedMessage
              id="screen.totp.recovery.warning"
              defaultMessage="⚠️ Save these codes — they won't be shown again. Use one if you lose access to your authenticator app."
            />
          </Text>
        </View>

        <View style={styles.codesContainer}>
          {recoveryCodes.map((rc) => (
            <Text key={rc} style={styles.code}>
              {rc}
            </Text>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Button
              variant="secondary"
              onPress={() => {
                void handleCopyAll();
              }}
            >
              {intl.formatMessage({ id: 'action.copyAll', defaultMessage: 'Copy All' })}
            </Button>
          </View>
          <View style={[styles.flex1, styles.rowGap]}>
            <Button
              variant="secondary"
              onPress={() => {
                void handleShare();
              }}
            >
              {intl.formatMessage({ id: 'action.share', defaultMessage: 'Share' })}
            </Button>
          </View>
        </View>

        <Button
          variant="primary"
          onPress={() => {
            navigation.navigate('Login');
          }}
        >
          {intl.formatMessage({ id: 'action.done', defaultMessage: 'Done' })}
        </Button>
      </ScrollView>
    );
  }

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

      {qrCodeUri !== '' && (
        <View style={styles.qrContainer}>
          <QRCode
            value={qrCodeUri}
            size={200}
            backgroundColor={t.colorSurfaceBase}
            color={t.colorTextPrimary}
          />
        </View>
      )}

      {manualEntryKey !== '' && (
        <View style={styles.manualKeyContainer}>
          <Text style={styles.manualKeyLabel}>
            <FormattedMessage
              id="screen.totp.manualKey"
              defaultMessage="Or enter this key manually:"
            />
          </Text>
          <TouchableOpacity
            onPress={() => {
              void Clipboard.setStringAsync(manualEntryKey);
            }}
            accessibilityLabel={intl.formatMessage({
              id: 'screen.totp.manualKeyCopy',
              defaultMessage: 'Copy manual entry key',
            })}
          >
            <Text style={styles.manualKeyValue}>{manualEntryKey}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Button variant="secondary" onPress={handleOpenInAuthenticator}>
        {intl.formatMessage({
          id: 'action.openInAuthenticator',
          defaultMessage: 'Open in Authenticator',
        })}
      </Button>

      <View style={styles.spacer} />

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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: t.spaceMd,
    backgroundColor: t.colorSurfaceBase,
    borderRadius: t.radiusMd,
  },
  manualKeyContainer: {
    backgroundColor: t.colorSurfaceMid,
    padding: t.spaceMd,
    borderRadius: t.radiusMd,
    marginBottom: t.spaceMd,
    alignItems: 'center',
  },
  manualKeyLabel: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeSm,
    marginBottom: t.spaceXs,
  },
  manualKeyValue: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeMd,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  spacer: {
    height: t.spaceMd,
  },
  warningBox: {
    backgroundColor: t.colorSurfaceMid,
    borderLeftWidth: 4,
    borderLeftColor: t.colorStatusWarning,
    padding: t.spaceMd,
    borderRadius: t.radiusSm,
    marginBottom: t.spaceLg,
  },
  warningText: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeSm,
    lineHeight: 20,
  },
  codesContainer: {
    backgroundColor: t.colorSurfaceMid,
    padding: t.spaceMd,
    borderRadius: t.radiusMd,
    marginBottom: t.spaceLg,
  },
  code: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeSm,
    fontFamily: 'monospace',
    paddingVertical: t.spaceXs,
  },
  row: {
    flexDirection: 'row',
    marginBottom: t.spaceMd,
  },
  flex1: {
    flex: 1,
  },
  rowGap: {
    marginLeft: t.spaceSm,
  },
});
