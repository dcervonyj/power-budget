import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useIntl } from 'react-intl';
import { makeStyles } from '../theme/index.js';
import { BiometricUnlockPanel } from '../glass/overlays/BiometricPanels.js';
import { biometricUnlockService } from '../../infrastructure/index.js';

interface Props {
  readonly visible: boolean;
  readonly onSuccess: () => void;
}

export function BiometricPromptOverlay({ visible, onSuccess }: Props): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const triggerAuth = async (): Promise<void> => {
    setAuthenticating(true);
    setFailed(false);
    try {
      const success = await biometricUnlockService.authenticate(
        intl.formatMessage({
          id: 'biometric.promptMessage',
          defaultMessage: 'Unlock Power Budget',
        }),
      );
      if (success) {
        onSuccess();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void triggerAuth();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <BiometricUnlockPanel
          authenticating={authenticating}
          failed={failed}
          onRetry={() => {
            void triggerAuth();
          }}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((glass) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: glass.space.lg,
    backgroundColor: glass.colors.base,
  },
}));
