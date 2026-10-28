import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';
import { classifyAuthError } from './authErrors.js';
import { LoginView, type LoginError } from './LoginView.js';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function toLoginError(error: unknown): LoginError {
  const failure = classifyAuthError(error);

  switch (failure) {
    case 'tooManyAttempts':
    case 'invalidCredentials':
    case 'invalidTotp':
      return failure;
    default:
      return 'serverError';
  }
}

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      setError('required');

      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await authService.login({
        email,
        password,
        ...(showTotp && totp ? { totpCode: totp } : {}),
      });

      if (result.requiresTotp) {
        setShowTotp(true);
      }
      // Navigation to the App stack happens when auth state is updated in RootNavigator.
    } catch (caught: unknown) {
      setError(toLoginError(caught));
    } finally {
      setLoading(false);
    }
  };

  const submit = (): void => {
    void handleLogin();
  };
  const forgotPassword = (): void => {
    navigation.navigate('MagicLink');
  };
  const createAccount = (): void => {
    navigation.navigate('Register');
  };

  return (
    <LoginView
      email={email}
      password={password}
      totp={totp}
      showTotp={showTotp}
      loading={loading}
      error={error}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onTotpChange={setTotp}
      onSubmit={submit}
      onForgotPassword={forgotPassword}
      onCreateAccount={createAccount}
    />
  );
}
