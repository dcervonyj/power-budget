import { apiClient } from '../../../composition.js';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LocaleCode, RegisterDto } from '@power-budget/shared-app/contract';
import { RegisterView, type RegisterError } from './RegisterView.js';

const SUPPORTED_LOCALES: readonly LocaleCode[] = ['en', 'uk', 'ru', 'pl'];

function resolveLocale(): LocaleCode {
  const stored = localStorage.getItem('pb_locale');

  return SUPPORTED_LOCALES.find((locale) => locale === stored) ?? 'en';
}

function isApiError(err: unknown): err is { response?: { status?: number } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function RegisterScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<RegisterError | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setRegisterError(null);
    try {
      // RegisterDto has no display name; it is set later in Settings (PATCH /users/me).
      const body: RegisterDto = { email, password, locale: resolveLocale() };
      await apiClient.post('/auth/register', body);
      // Keep RequireAuth's target (an invite link) for the login that follows.
      navigate('/login', { state: location.state });
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

  const onSubmit = (e: React.FormEvent): void => {
    void handleSubmit(e);
  };

  return (
    <RegisterView
      email={email}
      password={password}
      loading={isLoading}
      error={registerError}
      linkState={location.state}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
    />
  );
}
