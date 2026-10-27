import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import type { AuthTokensDto, LoginDto } from '@power-budget/shared-app/contract';
import { apiClient, tokenStore } from '../../../AppProviders.js';
import { returnPath } from '../../guards/returnPath.js';
import { LoginView, type LoginError } from './LoginView.js';

type LoginOutcome = 'requiresTotp' | LoginError;

/** Error bodies carry a stable `code` (CLN-002/CLN-004): 403 requires_totp, 401 totp_invalid, 429 ... */
function classifyLoginError(err: unknown): LoginOutcome {
  switch (readApiError(err).code) {
    case 'requires_totp':
      return 'requiresTotp';
    case 'totp_invalid':
      return 'invalidTotp';
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'too_many_requests':
      return 'tooManyAttempts';
    default:
      return 'serverError';
  }
}

export function LoginScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<LoginError | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);
    try {
      const body: LoginDto = showTotp && totp ? { email, password, totp } : { email, password };
      const res = await apiClient.post<AuthTokensDto>('/auth/login', body);
      await tokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
      // Back to where RequireAuth came from, e.g. the invite link /invite/accept?token=.
      navigate(returnPath(location.state));
    } catch (err) {
      const outcome = classifyLoginError(err);
      if (outcome === 'requiresTotp') {
        setShowTotp(true);
      } else {
        setLoginError(outcome);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent): void => {
    void handleSubmit(e);
  };

  return (
    <LoginView
      email={email}
      password={password}
      totp={totp}
      showTotp={showTotp}
      loading={isLoading}
      error={loginError}
      linkState={location.state}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onTotpChange={setTotp}
      onSubmit={onSubmit}
    />
  );
}
