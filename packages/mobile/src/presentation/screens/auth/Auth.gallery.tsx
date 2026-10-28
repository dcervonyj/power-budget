import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { LoginView, type LoginViewProps } from './LoginView.js';
import { MagicLinkView, type MagicLinkViewProps } from './MagicLinkView.js';
import { OAuthCallbackView } from './OAuthCallbackView.js';
import { RegisterView, type RegisterViewProps } from './RegisterView.js';
import { TotpEnrollmentView, type TotpEnrollmentViewProps } from './TotpEnrollmentView.js';

const EMAIL = 'anna@example.com';
const QR_URI = 'otpauth://totp/Power%20Budget:anna@example.com?secret=JBSWY3DPEHPK3PXP';
const SECRET = 'JBSW Y3DP EHPK 3PXP';

const useStyles = makeStyles((glass) => ({
  // The layout fills its parent and scrolls, so each fixture gets a phone-sized stage.
  stage: { height: 760, margin: -glass.space['3xl'], overflow: 'hidden' },
  tall: { height: 1180 },
}));

function Stage({
  tall = false,
  children,
}: {
  readonly tall?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return <View style={[styles.stage, tall ? styles.tall : null]}>{children}</View>;
}

function noop(): void {
  // Gallery fixtures do not react to input.
}

const LOGIN: LoginViewProps = {
  email: EMAIL,
  password: 'correct horse',
  totp: '',
  showTotp: false,
  loading: false,
  error: null,
  onEmailChange: noop,
  onPasswordChange: noop,
  onTotpChange: noop,
  onSubmit: noop,
  onForgotPassword: noop,
  onCreateAccount: noop,
};

const REGISTER: RegisterViewProps = {
  email: EMAIL,
  password: 'correct horse',
  locale: 'en',
  loading: false,
  error: null,
  sent: false,
  onEmailChange: noop,
  onPasswordChange: noop,
  onLocaleChange: noop,
  onSubmit: noop,
  onBackToLogin: noop,
};

const MAGIC_LINK: MagicLinkViewProps = {
  sent: false,
  email: EMAIL,
  loading: false,
  error: null,
  onEmailChange: noop,
  onSubmit: noop,
  onBackToLogin: noop,
};

const TOTP: TotpEnrollmentViewProps = {
  phase: 'qr',
  qrCodeUri: QR_URI,
  secret: SECRET,
  code: '482915',
  verifying: false,
  error: null,
  recoveryCodes: [],
  copied: false,
  onCodeChange: noop,
  onCopySecret: noop,
  onOpenAuthenticator: noop,
  onVerify: noop,
  onCopyCodes: noop,
  onDone: noop,
};

/** Log in with email and password. */
export function Login(): React.JSX.Element {
  return (
    <Stage>
      <LoginView {...LOGIN} />
    </Stage>
  );
}

export function LoginWrongPassword(): React.JSX.Element {
  return (
    <Stage>
      <LoginView {...LOGIN} error="invalidCredentials" />
    </Stage>
  );
}

export function LoginTwoFactorRequired(): React.JSX.Element {
  return (
    <Stage>
      <LoginView {...LOGIN} showTotp />
    </Stage>
  );
}

export function LoginTwoFactorInvalid(): React.JSX.Element {
  return (
    <Stage>
      <LoginView {...LOGIN} showTotp totp="123456" error="invalidTotp" />
    </Stage>
  );
}

export function Register(): React.JSX.Element {
  return (
    <Stage>
      <RegisterView {...REGISTER} />
    </Stage>
  );
}

export function RegisterEmailInUse(): React.JSX.Element {
  return (
    <Stage>
      <RegisterView {...REGISTER} error="emailInUse" />
    </Stage>
  );
}

export function RegisterSent(): React.JSX.Element {
  return (
    <Stage>
      <RegisterView {...REGISTER} sent />
    </Stage>
  );
}

export function MagicLinkRequest(): React.JSX.Element {
  return (
    <Stage>
      <MagicLinkView {...MAGIC_LINK} />
    </Stage>
  );
}

export function MagicLinkSent(): React.JSX.Element {
  return (
    <Stage>
      <MagicLinkView {...MAGIC_LINK} sent />
    </Stage>
  );
}

export function OAuthCallbackCompleting(): React.JSX.Element {
  return (
    <Stage>
      <OAuthCallbackView failed={false} onBackToLogin={noop} />
    </Stage>
  );
}

export function OAuthCallbackFailed(): React.JSX.Element {
  return (
    <Stage>
      <OAuthCallbackView failed onBackToLogin={noop} />
    </Stage>
  );
}

export function TotpEnrollment(): React.JSX.Element {
  return (
    <Stage tall>
      <TotpEnrollmentView {...TOTP} />
    </Stage>
  );
}

export function TotpEnrollmentInvalidCode(): React.JSX.Element {
  return (
    <Stage tall>
      <TotpEnrollmentView {...TOTP} error="codeWrong" />
    </Stage>
  );
}

export function TotpRecoveryCodes(): React.JSX.Element {
  return (
    <Stage>
      <TotpEnrollmentView
        {...TOTP}
        phase="recovery"
        recoveryCodes={['A1B2-C3D4', 'E5F6-G7H8', 'J9K1-L2M3', 'N4P5-Q6R7']}
      />
    </Stage>
  );
}
