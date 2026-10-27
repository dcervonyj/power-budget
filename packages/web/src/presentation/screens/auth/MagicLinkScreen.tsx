import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import type {
  AuthTokensDto,
  ConsumeMagicLinkDto,
  RequestMagicLinkDto,
} from '@power-budget/shared-app/contract';
import { apiClient, tokenStore } from '../../../AppProviders.js';
import { MagicLinkView, type MagicLinkError, type MagicLinkStage } from './MagicLinkView.js';

/** What a failed consume means (CLN-004): 403 requires_totp keeps the link valid. */
function classifyConsumeError(err: unknown): 'requiresTotp' | MagicLinkError {
  switch (readApiError(err).code) {
    case 'requires_totp':
      return 'requiresTotp';
    case 'totp_invalid':
      return 'invalidTotp';
    case 'too_many_requests':
      return 'tooManyAttempts';
    default:
      return 'consumeFailed';
  }
}

function classifyRequestError(err: unknown): MagicLinkError {
  return readApiError(err).code === 'too_many_requests' ? 'tooManyAttempts' : 'requestFailed';
}

export function MagicLinkScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<MagicLinkError | null>(null);
  const consumedOnMount = useRef(false);

  const consumeToken = useCallback(
    async (linkToken: string, code: string): Promise<void> => {
      setIsLoading(true);
      setMagicLinkError(null);
      try {
        const body: ConsumeMagicLinkDto = code
          ? { token: linkToken, totp: code }
          : { token: linkToken };
        const res = await apiClient.post<AuthTokensDto>('/auth/magic-link/consume', body);
        await tokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
        navigate('/dashboard');
      } catch (err) {
        const outcome = classifyConsumeError(err);
        if (outcome === 'requiresTotp') {
          setShowTotp(true);
        } else {
          setMagicLinkError(outcome);
        }
        setIsLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!token || consumedOnMount.current) {
      return;
    }
    consumedOnMount.current = true;
    void consumeToken(token, '');
  }, [token, consumeToken]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setMagicLinkError(null);
    try {
      const body: RequestMagicLinkDto = { email };
      await apiClient.post('/auth/magic-link/request', body);
      setSent(true);
    } catch (err) {
      setMagicLinkError(classifyRequestError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (token) {
      void consumeToken(token, totp);
    }
  };

  const onRequestSubmit = (e: React.FormEvent): void => {
    void handleSubmit(e);
  };

  return (
    <MagicLinkView
      stage={stageOf(token, sent)}
      email={email}
      totp={totp}
      showTotp={showTotp}
      loading={isLoading}
      error={magicLinkError}
      onEmailChange={setEmail}
      onTotpChange={setTotp}
      onRequestSubmit={onRequestSubmit}
      onTotpSubmit={handleTotpSubmit}
    />
  );
}

function stageOf(token: string | null, sent: boolean): MagicLinkStage {
  if (token) {
    return 'consume';
  }

  return sent ? 'sent' : 'request';
}
