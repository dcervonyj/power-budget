import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../../components/index.js';
import { AUTH_FORM_STYLE, AuthHeading, AuthNotice, AuthStatus, CodeField } from './AuthParts.js';

export type TotpVerifyError = 'invalid' | 'tooManyAttempts' | 'server';

export type TotpLoadError = 'alreadyEnabled' | 'server';

export interface TotpEnrollmentViewProps {
  /** Null while enrolment starts. */
  readonly enrollment: { readonly qrCodeUri: string; readonly secret: string } | null;
  readonly loadError: TotpLoadError | null;
  readonly code: string;
  readonly verifyError: TotpVerifyError | null;
  readonly verifying: boolean;
  readonly onCodeChange: (value: string) => void;
  readonly onSubmit: (event: React.FormEvent) => void;
}

const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
};

const QR_CARD_STYLE: React.CSSProperties = {
  alignSelf: 'center',
  padding: 'var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-control)',
  // A scanner needs dark modules on a light ground in both themes.
  background: '#fff',
  boxShadow: 'var(--pb-glass-clear-rim)',
  lineHeight: 0,
};

const SECRET_STYLE: React.CSSProperties = {
  padding: 'var(--pb-glass-space-sm) var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-fg)',
  wordBreak: 'break-all',
};

const HINT_ID = 'totp-code-hint';

export function TotpEnrollmentView(props: TotpEnrollmentViewProps): React.JSX.Element {
  const { enrollment, loadError } = props;

  return (
    <div>
      <AuthHeading
        title={
          <FormattedMessage
            id="screen.totpEnrollment.title"
            defaultMessage="Enable Two-Factor Authentication"
          />
        }
      />
      {loadError !== null && <AuthNotice message={<LoadErrorText error={loadError} />} />}
      {loadError === null && enrollment === null && (
        <AuthStatus>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </AuthStatus>
      )}
      {loadError === null && enrollment !== null && (
        <EnrollmentBody {...props} enrollment={enrollment} />
      )}
    </div>
  );
}

function EnrollmentBody({
  enrollment,
  code,
  verifyError,
  verifying,
  onCodeChange,
  onSubmit,
}: TotpEnrollmentViewProps & {
  readonly enrollment: { readonly qrCodeUri: string; readonly secret: string };
}): React.JSX.Element {
  const intl = useIntl();

  return (
    <div style={SECTION_STYLE}>
      <AuthStatus>
        <FormattedMessage
          id="screen.totpEnrollment.scanQr"
          defaultMessage="Scan this QR code with your authenticator app"
        />
      </AuthStatus>
      <div style={QR_CARD_STYLE}>
        <QRCodeSVG
          value={enrollment.qrCodeUri}
          size={200}
          title={intl.formatMessage({
            id: 'auth.totp.qrTitle',
            defaultMessage: 'QR code for your authenticator app',
          })}
        />
      </div>
      <AuthStatus>
        <FormattedMessage
          id="screen.totpEnrollment.secretBackup"
          defaultMessage="Or enter this code manually:"
        />
      </AuthStatus>
      <div style={SECRET_STYLE}>{enrollment.secret}</div>
      <form onSubmit={onSubmit} style={AUTH_FORM_STYLE}>
        <AuthStatus id={HINT_ID}>
          <FormattedMessage
            id="screen.totpEnrollment.verifyCode"
            defaultMessage="Enter the 6-digit code from your app to confirm"
          />
        </AuthStatus>
        <CodeField
          id="totp-code"
          label={intl.formatMessage({
            id: 'screen.totpEnrollment.codeLabel',
            defaultMessage: '6-digit code',
          })}
          value={code}
          onChange={onCodeChange}
          invalid={verifyError === 'invalid'}
          groupLabelId={HINT_ID}
        />
        {verifyError !== null && <AuthNotice message={<VerifyErrorText error={verifyError} />} />}
        <Button type="submit" loading={verifying}>
          <FormattedMessage id="screen.totpEnrollment.verify" defaultMessage="Verify" />
        </Button>
      </form>
    </div>
  );
}

function LoadErrorText({ error }: { readonly error: TotpLoadError }): React.JSX.Element {
  if (error === 'alreadyEnabled') {
    return (
      <FormattedMessage
        id="screen.totpEnrollment.error.alreadyEnabled"
        defaultMessage="Two-factor authentication is already enabled."
      />
    );
  }

  return (
    <FormattedMessage
      id="screen.totpEnrollment.error.server"
      defaultMessage="Server error. Please try again."
    />
  );
}

function VerifyErrorText({ error }: { readonly error: TotpVerifyError }): React.JSX.Element {
  switch (error) {
    case 'invalid':
      return (
        <FormattedMessage
          id="screen.totpEnrollment.error.invalid"
          defaultMessage="Invalid code. Please try again."
        />
      );
    case 'tooManyAttempts':
      return (
        <FormattedMessage
          id="auth.error.tooManyAttempts"
          defaultMessage="Too many attempts. Please wait a few minutes and try again."
        />
      );
    case 'server':
      return (
        <FormattedMessage
          id="screen.totpEnrollment.error.server"
          defaultMessage="Server error. Please try again."
        />
      );
  }
}
