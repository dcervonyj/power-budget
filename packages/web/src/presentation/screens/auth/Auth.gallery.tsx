import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthLayoutView } from '../../shell/AuthLayoutView.js';
import { LocaleSelect } from '../../shell/LocaleSelect.js';
import { BankConsentCallbackView } from './BankConsentCallbackView.js';
import { LoginView, type LoginViewProps } from './LoginView.js';
import { MagicLinkView, type MagicLinkViewProps } from './MagicLinkView.js';
import { RegisterView, type RegisterViewProps } from './RegisterView.js';
import { TotpEnrollmentView, type TotpEnrollmentViewProps } from './TotpEnrollmentView.js';

const STAGE: React.CSSProperties = {
  margin: 'calc(-1 * var(--pb-glass-space-3xl))',
  overflow: 'hidden',
};

const EMAIL = 'anna@example.com';
const QR_URI = 'otpauth://totp/Power%20Budget:anna@example.com?secret=JBSWY3DPEHPK3PXP';
const SECRET = 'JBSW Y3DP EHPK 3PXP';

function noop(): void {
  // Gallery fixtures do not react to input.
}

function Framed({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={STAGE}>
        <AuthLayoutView
          language={<LocaleSelect id="gallery-auth-locale" locale="en" onChange={noop} />}
        >
          {children}
        </AuthLayoutView>
      </div>
    </MemoryRouter>
  );
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
};

const REGISTER: RegisterViewProps = {
  email: EMAIL,
  password: 'correct horse',
  loading: false,
  error: null,
  onEmailChange: noop,
  onPasswordChange: noop,
  onSubmit: noop,
};

const MAGIC_LINK: MagicLinkViewProps = {
  stage: 'request',
  email: EMAIL,
  totp: '',
  showTotp: false,
  loading: false,
  error: null,
  onEmailChange: noop,
  onTotpChange: noop,
  onRequestSubmit: noop,
  onTotpSubmit: noop,
};

const TOTP: TotpEnrollmentViewProps = {
  enrollment: { qrCodeUri: QR_URI, secret: SECRET },
  loadError: null,
  code: '482915',
  verifyError: null,
  verifying: false,
  onCodeChange: noop,
  onSubmit: noop,
};

export function Login(): React.JSX.Element {
  return (
    <Framed>
      <LoginView {...LOGIN} />
    </Framed>
  );
}

export function LoginWrongPassword(): React.JSX.Element {
  return (
    <Framed>
      <LoginView {...LOGIN} error="invalidCredentials" />
    </Framed>
  );
}

export function LoginTwoFactorRequired(): React.JSX.Element {
  return (
    <Framed>
      <LoginView {...LOGIN} showTotp />
    </Framed>
  );
}

export function LoginTwoFactorInvalid(): React.JSX.Element {
  return (
    <Framed>
      <LoginView {...LOGIN} showTotp totp="123456" error="invalidTotp" />
    </Framed>
  );
}

export function Register(): React.JSX.Element {
  return (
    <Framed>
      <RegisterView {...REGISTER} />
    </Framed>
  );
}

export function RegisterEmailInUse(): React.JSX.Element {
  return (
    <Framed>
      <RegisterView {...REGISTER} error="emailInUse" />
    </Framed>
  );
}

export function MagicLinkRequest(): React.JSX.Element {
  return (
    <Framed>
      <MagicLinkView {...MAGIC_LINK} />
    </Framed>
  );
}

export function MagicLinkSent(): React.JSX.Element {
  return (
    <Framed>
      <MagicLinkView {...MAGIC_LINK} stage="sent" />
    </Framed>
  );
}

export function MagicLinkExpired(): React.JSX.Element {
  return (
    <Framed>
      <MagicLinkView {...MAGIC_LINK} stage="consume" error="consumeFailed" />
    </Framed>
  );
}

export function TotpEnrollment(): React.JSX.Element {
  return (
    <Framed>
      <TotpEnrollmentView {...TOTP} />
    </Framed>
  );
}

export function TotpEnrollmentInvalidCode(): React.JSX.Element {
  return (
    <Framed>
      <TotpEnrollmentView {...TOTP} verifyError="invalid" />
    </Framed>
  );
}

export function BankConsentCompleting(): React.JSX.Element {
  return (
    <Framed>
      <BankConsentCallbackView failed={false} />
    </Framed>
  );
}

export function BankConsentFailed(): React.JSX.Element {
  return (
    <Framed>
      <BankConsentCallbackView failed />
    </Framed>
  );
}
