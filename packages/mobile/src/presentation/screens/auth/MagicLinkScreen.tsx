import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';
import { classifyAuthError } from './authErrors.js';
import { MagicLinkView, type MagicLinkError } from './MagicLinkView.js';

type Props = NativeStackScreenProps<AuthStackParamList, 'MagicLink'>;

export function MagicLinkScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<MagicLinkError | null>(null);

  const handleRequest = async (): Promise<void> => {
    if (!email) {
      setError('required');

      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.requestMagicLink(email);
      setSent(true);
    } catch (caught: unknown) {
      setError(
        classifyAuthError(caught) === 'tooManyAttempts' ? 'tooManyAttempts' : 'requestFailed',
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = (): void => {
    void handleRequest();
  };
  const backToLogin = (): void => {
    navigation.popTo('Login');
  };

  return (
    <MagicLinkView
      sent={sent}
      email={email}
      loading={loading}
      error={error}
      onEmailChange={setEmail}
      onSubmit={submit}
      onBackToLogin={backToLogin}
    />
  );
}
