import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';

type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

function resolveLocale(): SupportedLocale {
  const stored = localStorage.getItem('pb_locale');
  const supported: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];
  return supported.includes(stored as SupportedLocale) ? (stored as SupportedLocale) : 'en';
}

type RegisterError = 'emailInUse' | 'serverError' | null;

function isApiError(err: unknown): err is { response?: { status?: number } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function RegisterScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<RegisterError>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setRegisterError(null);
    try {
      await apiClient.post('/auth/register', {
        email,
        password,
        displayName,
        locale: resolveLocale(),
      });
      navigate('/login');
    } catch (err) {
      if (isApiError(err) && err.response?.status === 409) {
        setRegisterError('emailInUse');
      } else {
        setRegisterError('serverError');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>
        <FormattedMessage id="screen.register.title" defaultMessage="Create account" />
      </h1>
      <form onSubmit={handleSubmit}>
        <Input
          id="register-email"
          type="email"
          label={intl.formatMessage({
            id: 'screen.register.email.label',
            defaultMessage: 'Email',
          })}
          value={email}
          onChange={setEmail}
        />
        <Input
          id="register-password"
          type="password"
          label={intl.formatMessage({
            id: 'screen.register.password.label',
            defaultMessage: 'Password',
          })}
          value={password}
          onChange={setPassword}
        />
        <Input
          id="register-displayName"
          type="text"
          label={intl.formatMessage({
            id: 'screen.register.displayName.label',
            defaultMessage: 'Display name',
          })}
          value={displayName}
          onChange={setDisplayName}
        />
        {registerError === 'emailInUse' && (
          <p>
            <FormattedMessage
              id="screen.register.error.emailInUse"
              defaultMessage="An account with this email already exists."
            />
          </p>
        )}
        {registerError === 'serverError' && (
          <p>
            <FormattedMessage
              id="screen.register.error.serverError"
              defaultMessage="Something went wrong. Please try again."
            />
          </p>
        )}
        <Button type="submit" loading={isLoading}>
          <FormattedMessage id="screen.register.submit" defaultMessage="Create account" />
        </Button>
      </form>
      <Link to="/login">
        <FormattedMessage
          id="screen.register.loginLink"
          defaultMessage="Already have an account? Log in"
        />
      </Link>
    </div>
  );
}
