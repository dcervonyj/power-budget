import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { readApiError } from '@power-budget/shared-app';
import type { TotpEnrollmentDto, VerifyTotpDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';
import { useTheme } from '../../components/ThemeContext.js';

// `POST /auth/totp/enable` answers TotpEnrollmentDto `{ qrCodeUri, secret }`: the API
// issues no recovery codes, so there is no recovery-code step.
type VerifyError = 'invalid' | 'tooManyAttempts' | 'server' | null;

function classifyVerifyError(err: unknown): Exclude<VerifyError, null> {
  switch (readApiError(err).code) {
    case 'totp_invalid':
      return 'invalid';
    case 'too_many_requests':
      return 'tooManyAttempts';
    default:
      return 'server';
  }
}

export function TotpEnrollmentScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();
  const theme = useTheme();

  const [totpData, setTotpData] = useState<TotpEnrollmentDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<VerifyError>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const enrolmentStarted = useRef(false);

  useEffect(() => {
    // Start enrolment once: every call issues a new pending secret, so a second
    // call (StrictMode, locale load) would invalidate the QR code on screen.
    if (enrolmentStarted.current) {
      return;
    }
    enrolmentStarted.current = true;
    const enableTotp = async (): Promise<void> => {
      try {
        const res = await apiClient.post<TotpEnrollmentDto>('/auth/totp/enable', {});
        setTotpData(res.data);
      } catch (err) {
        // 403: TOTP is already on; replacing it needs a recent verification (CLN-004).
        setLoadError(
          readApiError(err).status === 403
            ? intl.formatMessage({
                id: 'screen.totpEnrollment.error.alreadyEnabled',
                defaultMessage: 'Two-factor authentication is already enabled.',
              })
            : intl.formatMessage({
                id: 'screen.totpEnrollment.error.server',
                defaultMessage: 'Server error. Please try again.',
              }),
        );
      }
    };
    void enableTotp();
  }, [intl]);

  const handleVerify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setVerifyError(null);
    setIsVerifying(true);
    try {
      const body: VerifyTotpDto = { code };
      await apiClient.post('/auth/totp/verify', body);
      navigate('/dashboard');
    } catch (err: unknown) {
      setVerifyError(classifyVerifyError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: theme.space['2xl'] }}>
        <p style={{ color: theme.color.status.danger }}>{loadError}</p>
      </div>
    );
  }

  if (!totpData) {
    return (
      <div style={{ padding: theme.space['2xl'] }}>
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: theme.space['2xl'] }}>
      <h1
        style={{
          color: theme.color.text.primary,
          fontSize: theme.fontSize['2xl'],
          marginBottom: theme.space.lg,
        }}
      >
        <FormattedMessage
          id="screen.totpEnrollment.title"
          defaultMessage="Enable Two-Factor Authentication"
        />
      </h1>

      <p style={{ color: theme.color.text.secondary, marginBottom: theme.space.lg }}>
        <FormattedMessage
          id="screen.totpEnrollment.scanQr"
          defaultMessage="Scan this QR code with your authenticator app"
        />
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.space.lg }}>
        <QRCodeSVG value={totpData.qrCodeUri} size={200} />
      </div>

      <p style={{ color: theme.color.text.secondary, marginBottom: theme.space.xs }}>
        <FormattedMessage
          id="screen.totpEnrollment.secretBackup"
          defaultMessage="Or enter this code manually:"
        />
      </p>
      <div
        style={{
          backgroundColor: theme.color.surface.raised,
          border: `1px solid ${theme.color.border.subtle}`,
          borderRadius: 4,
          padding: theme.space.md,
          fontFamily: 'monospace',
          fontSize: theme.fontSize.sm,
          color: theme.color.text.primary,
          marginBottom: theme.space['2xl'],
          wordBreak: 'break-all',
        }}
      >
        {totpData.secret}
      </div>

      <form
        onSubmit={(e) => {
          void handleVerify(e);
        }}
      >
        <p style={{ color: theme.color.text.secondary, marginBottom: theme.space.sm }}>
          <FormattedMessage
            id="screen.totpEnrollment.verifyCode"
            defaultMessage="Enter the 6-digit code from your app to confirm"
          />
        </p>
        <Input
          id="totp-code"
          type="text"
          label={intl.formatMessage({
            id: 'screen.totpEnrollment.codeLabel',
            defaultMessage: '6-digit code',
          })}
          value={code}
          onChange={setCode}
        />
        {verifyError === 'invalid' && (
          <p style={{ color: theme.color.status.danger }}>
            <FormattedMessage
              id="screen.totpEnrollment.error.invalid"
              defaultMessage="Invalid code. Please try again."
            />
          </p>
        )}
        {verifyError === 'tooManyAttempts' && (
          <p style={{ color: theme.color.status.danger }}>
            <FormattedMessage
              id="auth.error.tooManyAttempts"
              defaultMessage="Too many attempts. Please wait a few minutes and try again."
            />
          </p>
        )}
        {verifyError === 'server' && (
          <p style={{ color: theme.color.status.danger }}>
            <FormattedMessage
              id="screen.totpEnrollment.error.server"
              defaultMessage="Server error. Please try again."
            />
          </p>
        )}
        <Button type="submit" loading={isVerifying}>
          <FormattedMessage id="screen.totpEnrollment.verify" defaultMessage="Verify" />
        </Button>
      </form>
    </div>
  );
}
