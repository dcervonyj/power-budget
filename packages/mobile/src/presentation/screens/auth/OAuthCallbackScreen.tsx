import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';
import { OAuthCallbackView } from './OAuthCallbackView.js';

type Props = NativeStackScreenProps<AuthStackParamList, 'OAuthCallback'>;

export function OAuthCallbackScreen({ route, navigation }: Props): React.JSX.Element {
  const { code, state } = route.params;
  const [failed, setFailed] = useState(!code);

  useEffect(() => {
    if (!code) {
      return;
    }

    void authService
      .handleOAuthCallback(code, state)
      .then(() => {
        navigation.popTo('Login');
      })
      .catch(() => {
        setFailed(true);
      });
  }, [code, state]);

  const backToLogin = (): void => {
    navigation.popTo('Login');
  };

  return <OAuthCallbackView failed={failed} onBackToLogin={backToLogin} />;
}
