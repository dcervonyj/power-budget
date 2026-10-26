import React, { useState } from 'react';
import { View } from 'react-native';
import { useIntl } from 'react-intl';
import { makeStyles } from '../theme/index.js';
import { AmbientField } from '../glass/material/AmbientField.js';
import { BiometricOptInPanel } from '../glass/overlays/BiometricPanels.js';
import { useToast } from '../glass/overlays/Toast.js';
import { biometricUnlockService } from '../../infrastructure/index.js';

interface Props {
  readonly onDone: () => void;
}

/** Shown once on first launch when biometrics are available. */
export function BiometricOptInPrompt({ onDone }: Props): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleEnable = async (): Promise<void> => {
    setLoading(true);
    try {
      const success = await biometricUnlockService.authenticate(
        intl.formatMessage({
          id: 'biometric.optIn.promptMessage',
          defaultMessage: 'Verify to enable biometric unlock',
        }),
      );
      if (success) {
        await biometricUnlockService.setBiometricEnabled(true);
        onDone();
      } else {
        toast.show(
          intl.formatMessage({
            id: 'biometric.optIn.authFailed',
            defaultMessage: 'Authentication failed. Biometric unlock was not enabled.',
          }),
        );
        onDone();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    await biometricUnlockService.setBiometricEnabled(false);
    onDone();
  };

  return (
    <View style={styles.container}>
      <AmbientField />
      <BiometricOptInPanel
        loading={loading}
        onEnable={() => {
          void handleEnable();
        }}
        onSkip={() => {
          void handleSkip();
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((glass) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: glass.space.lg,
    backgroundColor: glass.colors.base,
  },
}));
