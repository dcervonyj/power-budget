import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import { apiClient, tokenStore } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

type LoginError = 'invalidCredentials' | 'invalidTotp' | 'tooManyAttempts' | 'serverError' | null;

type LoginOutcome = 'requiresTotp' | Exclude<LoginError, null>;

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
  const intl = useIntl();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<LoginError>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);
    try {
      const body: { email: string; password: string; totp?: string } = { email, password };
      if (showTotp && totp) {
        body.totp = totp;
      }
      const res = await apiClient.post<LoginResponse>('/auth/login', body);
      await tokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
      navigate('/dashboard');
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

  return (
    <div>
      <h1>
        <FormattedMessage id="screen.login.title" defaultMessage="Log in" />
      </h1>
      <form onSubmit={handleSubmit}>
        <Input
          id="login-email"
          type="email"
          label={intl.formatMessage({ id: 'screen.login.email.label', defaultMessage: 'Email' })}
          value={email}
          onChange={setEmail}
        />
        <Input
          id="login-password"
          type="password"
          label={intl.formatMessage({
            id: 'screen.login.password.label',
            defaultMessage: 'Password',
          })}
          value={password}
          onChange={setPassword}
        />
        {showTotp && (
          <Input
            id="login-totp"
            type="text"
            label={intl.formatMessage({
              id: 'screen.login.totp.label',
              defaultMessage: 'Authenticator code',
            })}
            value={totp}
            onChange={setTotp}
          />
        )}
        {loginError === 'invalidCredentials' && (
          <p>
            <FormattedMessage
              id="screen.login.error.invalidCredentials"
              defaultMessage="Invalid email or password."
            />
          </p>
        )}
        {loginError === 'invalidTotp' && (
          <p>
            <FormattedMessage
              id="screen.login.error.invalidTotp"
              defaultMessage="Invalid authenticator code."
            />
          </p>
        )}
        {loginError === 'tooManyAttempts' && (
          <p role="alert">
            <FormattedMessage
              id="auth.error.tooManyAttempts"
              defaultMessage="Too many attempts. Please wait a few minutes and try again."
            />
          </p>
        )}
        {loginError === 'serverError' && (
          <p>
            <FormattedMessage
              id="screen.login.error.serverError"
              defaultMessage="Something went wrong. Please try again."
            />
          </p>
        )}
        <Button type="submit" loading={isLoading}>
          <FormattedMessage id="screen.login.submit" defaultMessage="Log in" />
        </Button>
      </form>
      <Link to="/auth/magic-link">
        <FormattedMessage id="screen.login.forgotPassword" defaultMessage="Forgot password?" />
      </Link>
      <Link to="/register">
        <FormattedMessage id="screen.login.createAccount" defaultMessage="Create account" />
      </Link>
    </div>
  );
}
