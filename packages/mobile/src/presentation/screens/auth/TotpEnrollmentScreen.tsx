import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import type { AuthStackParamList } from '../../navigation/types.js';
import { authService } from '../../../infrastructure/index.js';
import { CODE_LENGTH } from './AuthParts.js';
import { TotpEnrollmentView, type TotpError, type TotpPhase } from './TotpEnrollmentView.js';

type Props = NativeStackScreenProps<AuthStackParamList, 'TotpEnrollment'>;

/** TotpEnrollmentDto carries no recovery codes yet, so the recovery phase has none to show. */
const NO_RECOVERY_CODES: readonly string[] = [];

export function TotpEnrollmentScreen({ navigation }: Props): React.JSX.Element {
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [phase, setPhase] = useState<TotpPhase>('loading');
  const [error, setError] = useState<TotpError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void authService
      .enableTotp()
      .then(({ qrCodeUri: uri, secret: key }) => {
        setQrCodeUri(uri);
        setSecret(key);
        setPhase('qr');
      })
      .catch(() => {
        setPhase('qr');
        setError('setupFailed');
      });
  }, []);

  const openAuthenticator = (): void => {
    if (!qrCodeUri) {
      return;
    }
    void Linking.openURL(qrCodeUri).catch(() => {
      setError('noAuthenticator');
    });
  };

  const verify = async (): Promise<void> => {
    if (code.length !== CODE_LENGTH) {
      setError('codeInvalid');

      return;
    }

    setVerifying(true);
    setError(null);
    try {
      await authService.verifyTotp(code);
      setPhase('recovery');
    } catch {
      setError('codeWrong');
    } finally {
      setVerifying(false);
    }
  };

  const copyCodes = async (): Promise<void> => {
    await Clipboard.setStringAsync(NO_RECOVERY_CODES.join('\n'));
    setCopied(true);
  };

  const copySecret = (): void => {
    void Clipboard.setStringAsync(secret);
  };
  const submit = (): void => {
    void verify();
  };
  const copyAll = (): void => {
    void copyCodes();
  };
  const done = (): void => {
    navigation.popTo('Login');
  };

  return (
    <TotpEnrollmentView
      phase={phase}
      qrCodeUri={qrCodeUri}
      secret={secret}
      code={code}
      verifying={verifying}
      error={error}
      recoveryCodes={NO_RECOVERY_CODES}
      copied={copied}
      onCodeChange={setCode}
      onCopySecret={copySecret}
      onOpenAuthenticator={openAuthenticator}
      onVerify={submit}
      onCopyCodes={copyAll}
      onDone={done}
    />
  );
}
