import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';
import { classifyAuthError } from './authErrors.js';
import { RegisterView, type RegisterError, type RegisterLocale } from './RegisterView.js';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

function toRegisterError(error: unknown): RegisterError {
  const failure = classifyAuthError(error);

  switch (failure) {
    case 'tooManyAttempts':
    case 'emailInUse':
      return failure;
    case 'invalidCredentials':
    case 'invalidTotp':
    case 'other':
    default:
      return 'serverError';
  }
}

export function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [locale, setLocale] = useState<RegisterLocale>('en');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<RegisterError | null>(null);

  const handleRegister = async (): Promise<void> => {
    if (!email || !password) {
      setError('required');

      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.register({ email, password, locale });
      setSent(true);
    } catch (caught: unknown) {
      setError(toRegisterError(caught));
    } finally {
      setLoading(false);
    }
  };

  const submit = (): void => {
    void handleRegister();
  };
  const backToLogin = (): void => {
    navigation.popTo('Login');
  };

  return (
    <RegisterView
      email={email}
      password={password}
      locale={locale}
      loading={loading}
      error={error}
      sent={sent}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onLocaleChange={setLocale}
      onSubmit={submit}
      onBackToLogin={backToLogin}
    />
  );
}
