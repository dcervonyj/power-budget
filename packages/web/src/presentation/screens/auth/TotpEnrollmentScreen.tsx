import { apiClient } from '../../../composition.js';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import type { TotpEnrollmentDto, VerifyTotpDto } from '@power-budget/shared-app/contract';
import {
  TotpEnrollmentView,
  type TotpLoadError,
  type TotpVerifyError,
} from './TotpEnrollmentView.js';

// `POST /auth/totp/enable` answers TotpEnrollmentDto `{ qrCodeUri, secret }`: the API
// issues no recovery codes, so there is no recovery-code step.
function classifyVerifyError(err: unknown): TotpVerifyError {
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
  const navigate = useNavigate();

  const [totpData, setTotpData] = useState<TotpEnrollmentDto | null>(null);
  const [loadError, setLoadError] = useState<TotpLoadError | null>(null);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<TotpVerifyError | null>(null);
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
        setLoadError(readApiError(err).status === 403 ? 'alreadyEnabled' : 'server');
      }
    };
    void enableTotp();
  }, []);

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

  const onSubmit = (e: React.FormEvent): void => {
    void handleVerify(e);
  };

  return (
    <TotpEnrollmentView
      enrollment={totpData}
      loadError={loadError}
      code={code}
      verifyError={verifyError}
      verifying={isVerifying}
      onCodeChange={setCode}
      onSubmit={onSubmit}
    />
  );
}
