import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';
import { useTheme } from '../../components/ThemeContext.js';

interface TotpEnableResponse {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

type Step = 'setup' | 'recovery';
type VerifyError = 'invalid' | 'server' | null;

export function TotpEnrollmentScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('setup');
  const [totpData, setTotpData] = useState<TotpEnableResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<VerifyError>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const enableTotp = async (): Promise<void> => {
      try {
        const res = await apiClient.post('/auth/totp/enable', {});
        const data = res.data as unknown as TotpEnableResponse;
        setTotpData(data);
      } catch {
        setLoadError(
          intl.formatMessage({
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
      await apiClient.post('/auth/totp/verify', { code });
      setRecoveryCodes(totpData?.recoveryCodes ?? []);
      setStep('recovery');
    } catch (err: unknown) {
      const isApiErr =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { status?: number } }).response?.status === 'number';
      if (isApiErr && (err as { response: { status: number } }).response.status === 401) {
        setVerifyError('invalid');
      } else {
        setVerifyError('server');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  const handlePrint = (): void => {
    const content = recoveryCodes.join('\n');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<pre>${content}</pre>`);
      win.print();
      win.close();
    }
  };

  const handleDone = (): void => {
    navigate('/dashboard');
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

  if (step === 'recovery') {
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
            id="screen.totpEnrollment.recoveryCodes.title"
            defaultMessage="Save your recovery codes"
          />
        </h1>
        <p style={{ color: theme.color.text.secondary, marginBottom: theme.space.lg }}>
          <FormattedMessage
            id="screen.totpEnrollment.recoveryCodes.warning"
            defaultMessage="These codes will only be shown once. Save them in a safe place."
          />
        </p>
        <div
          style={{
            backgroundColor: theme.color.surface.raised,
            border: `1px solid ${theme.color.border.subtle}`,
            borderRadius: 8,
            padding: theme.space.lg,
            marginBottom: theme.space.lg,
            fontFamily: 'monospace',
          }}
        >
          {recoveryCodes.map((c) => (
            <div key={c} style={{ padding: `${theme.space.xs}px 0`, color: theme.color.text.primary }}>
              {c}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: theme.space.md, marginBottom: theme.space.lg }}>
          <Button variant="secondary" onClick={handleCopy}>
            <FormattedMessage
              id="screen.totpEnrollment.recoveryCodes.copy"
              defaultMessage="Copy all"
            />
            {copied ? ' ✓' : ''}
          </Button>
          <Button variant="secondary" onClick={handlePrint}>
            <FormattedMessage
              id="screen.totpEnrollment.recoveryCodes.print"
              defaultMessage="Print"
            />
          </Button>
        </div>
        <Button variant="primary" onClick={handleDone}>
          <FormattedMessage
            id="screen.totpEnrollment.recoveryCodes.done"
            defaultMessage="I've saved my recovery codes"
          />
        </Button>
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
        <QRCodeSVG value={totpData.otpauthUri} size={200} />
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

      <form onSubmit={(e) => { void handleVerify(e); }}>
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
