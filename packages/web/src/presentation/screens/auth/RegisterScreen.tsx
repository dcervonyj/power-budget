import { apiClient } from '../../../composition.js';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import type { LocaleCode, RegisterDto } from '@power-budget/shared-app/contract';
import { MIN_PASSWORD_LENGTH, RegisterView, type RegisterError } from './RegisterView.js';

const SUPPORTED_LOCALES: readonly LocaleCode[] = ['en', 'uk', 'ru', 'pl'];

function resolveLocale(): LocaleCode {
  const stored = localStorage.getItem('pb_locale');

  return SUPPORTED_LOCALES.find((locale) => locale === stored) ?? 'en';
}

function classifyRegisterError(err: unknown): RegisterError {
  const { status, code } = readApiError(err);
  if (status === 409) {
    return 'emailInUse';
  }
  if (status === 429 || code === 'too_many_requests') {
    return 'tooManyAttempts';
  }
  if (status === 400) {
    return 'invalidInput';
  }

  return 'serverError';
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setRegisterError('passwordTooShort');

      return;
    }
    setIsLoading(true);
    setRegisterError(null);
    try {
      // RegisterDto has no display name; it is set later in Settings (PATCH /users/me).
      const body: RegisterDto = { email, password, locale: resolveLocale() };
      await apiClient.post('/auth/register', body);
      // Keep RequireAuth's target (an invite link) for the login that follows.
      void navigate('/login', { state: location.state });
    } catch (err) {
      setRegisterError(classifyRegisterError(err));
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
