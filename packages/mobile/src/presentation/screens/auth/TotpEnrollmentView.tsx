import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../components/Button.js';
import { makeStyles } from '../../theme/index.js';
import { BODY_FONT, TOUCH_TARGET } from '../../glass/controls/fonts.js';
import { AuthHeading, AuthLayout, AuthNotice, AuthStatus, CodeField } from './AuthParts.js';

export type TotpPhase = 'loading' | 'qr' | 'recovery';

export type TotpError = 'setupFailed' | 'noAuthenticator' | 'codeInvalid' | 'codeWrong';

export interface TotpEnrollmentViewProps {
  readonly phase: TotpPhase;
  readonly qrCodeUri: string;
  readonly secret: string;
  readonly code: string;
  readonly verifying: boolean;
  readonly error: TotpError | null;
  readonly recoveryCodes: readonly string[];
  /** The recovery codes were copied. */
  readonly copied: boolean;
  readonly onCodeChange: (value: string) => void;
  readonly onCopySecret: () => void;
  readonly onOpenAuthenticator: () => void;
  readonly onVerify: () => void;
  readonly onCopyCodes: () => void;
  readonly onDone: () => void;
}

const QR_SIZE = 200;

const useStyles = makeStyles((glass) => ({
  // A scanner needs dark modules on a light ground in both themes.
  qrCard: {
    alignSelf: 'center',
    padding: glass.space.md,
    borderRadius: glass.radius.control,
    backgroundColor: '#FFFFFF',
    boxShadow: glass.colors.clearRim,
  },
  secret: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: glass.space.md,
    paddingVertical: glass.space.sm,
    borderRadius: glass.radius.control,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  secretText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    letterSpacing: 2,
  },
  codes: { gap: glass.space.xs },
  codeText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    letterSpacing: 2,
  },
  row: { flexDirection: 'row', gap: glass.space.sm },
  flex: { flex: 1 },
}));

export function TotpEnrollmentView(props: TotpEnrollmentViewProps): React.JSX.Element {
  const intl = useIntl();

  if (props.phase === 'loading') {
    return (
      <AuthLayout>
        <AuthStatus>
          {intl.formatMessage({
            id: 'auth.totp.loading',
            defaultMessage: 'Setting up two-factor authentication…',
          })}
        </AuthStatus>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {props.phase === 'recovery' ? <RecoveryBody {...props} /> : <EnrollmentBody {...props} />}
    </AuthLayout>
  );
}

function EnrollmentBody(props: TotpEnrollmentViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();

  return (
    <>
      <AuthHeading
        title={intl.formatMessage({
          id: 'auth.totp.title',
          defaultMessage: 'Set up two-factor authentication',
        })}
      />
      <AuthStatus>
        {intl.formatMessage({
          id: 'auth.totp.scanQr',
          defaultMessage: 'Scan this QR code with your authenticator app',
        })}
      </AuthStatus>
      {props.qrCodeUri !== '' && (
        <View style={styles.qrCard}>
          <QRCode
            value={props.qrCodeUri}
            size={QR_SIZE}
            backgroundColor="#FFFFFF"
            color="#000000"
          />
        </View>
      )}
      {props.secret !== '' && (
        <>
          <AuthStatus>
            {intl.formatMessage({
              id: 'auth.totp.manualKey',
              defaultMessage: 'Or enter this code manually:',
            })}
          </AuthStatus>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage(
              { id: 'auth.totp.manualKeyCopy', defaultMessage: 'Copy {secret}' },
              { secret: props.secret },
            )}
            onPress={props.onCopySecret}
            style={styles.secret}
          >
            <Text style={styles.secretText}>{props.secret}</Text>
          </Pressable>
        </>
      )}
      <Button variant="secondary" onPress={props.onOpenAuthenticator}>
        {intl.formatMessage({
          id: 'auth.totp.openAuthenticator',
          defaultMessage: 'Open in authenticator',
        })}
      </Button>
      <AuthStatus>
        {intl.formatMessage({
          id: 'auth.totp.verifyHint',
          defaultMessage: 'Enter the 6-digit code from your app to confirm',
        })}
      </AuthStatus>
      <CodeField
        label={intl.formatMessage({ id: 'auth.totp.codeLabel', defaultMessage: '6-digit code' })}
        value={props.code}
        onChangeText={props.onCodeChange}
        invalid={props.error === 'codeInvalid' || props.error === 'codeWrong'}
      />
      {props.error !== null && <AuthNotice message={totpErrorText(intl, props.error)} />}
      <Button loading={props.verifying} onPress={props.onVerify}>
        {intl.formatMessage({ id: 'auth.totp.verify', defaultMessage: 'Verify' })}
      </Button>
    </>
  );
}

function RecoveryBody(props: TotpEnrollmentViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();

  return (
    <>
      <AuthHeading
        title={intl.formatMessage({
          id: 'auth.totp.recovery.title',
          defaultMessage: 'Recovery codes',
        })}
        subtitle={intl.formatMessage({
          id: 'auth.totp.recovery.warning',
          defaultMessage:
            "Save these codes, they won't be shown again. Use one if you lose access to your authenticator app.",
        })}
      />
      <View style={styles.codes}>
        {props.recoveryCodes.map((recoveryCode) => (
          <Text key={recoveryCode} style={styles.codeText}>
            {recoveryCode}
          </Text>
        ))}
      </View>
      {props.copied && (
        <AuthStatus>
          {intl.formatMessage({
            id: 'auth.totp.recovery.copied',
            defaultMessage: 'Recovery codes copied to clipboard.',
          })}
        </AuthStatus>
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button variant="secondary" onPress={props.onCopyCodes}>
            {intl.formatMessage({ id: 'auth.totp.recovery.copyAll', defaultMessage: 'Copy all' })}
          </Button>
        </View>
        <View style={styles.flex}>
          <Button variant="secondary" onPress={props.onCopyCodes}>
            {intl.formatMessage({ id: 'auth.totp.recovery.share', defaultMessage: 'Share' })}
          </Button>
        </View>
      </View>
      <Button onPress={props.onDone}>
        {intl.formatMessage({ id: 'auth.totp.recovery.done', defaultMessage: 'Done' })}
      </Button>
    </>
  );
}

function totpErrorText(intl: ReturnType<typeof useIntl>, error: TotpError): string {
  switch (error) {
    case 'setupFailed':
      return intl.formatMessage({
        id: 'auth.totp.error.setupFailed',
        defaultMessage: 'Could not set up two-factor authentication. Please try again.',
      });
    case 'noAuthenticator':
      return intl.formatMessage({
        id: 'auth.totp.error.noAuthenticator',
        defaultMessage: 'No authenticator app found. Install one from the app store.',
      });
    case 'codeInvalid':
      return intl.formatMessage({
        id: 'auth.totp.error.codeInvalid',
        defaultMessage: 'Please enter the 6-digit code.',
      });
    case 'codeWrong':
      return intl.formatMessage({
        id: 'auth.totp.error.codeWrong',
        defaultMessage: 'Invalid code. Please try again.',
      });
  }
}
