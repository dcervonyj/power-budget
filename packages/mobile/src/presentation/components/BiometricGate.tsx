import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { biometricUnlockService } from '../../infrastructure/index.js';
import { BiometricPromptOverlay } from './BiometricPromptOverlay.js';
import { BiometricOptInPrompt } from './BiometricOptInPrompt.js';

/** After this many ms in background, require re-authentication. */
const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000;

type InitState = 'checking' | 'opt-in' | 'ready';

interface Props {
  readonly children: React.ReactNode;
}

/**
 * Wraps the app to provide biometric unlock.
 *
 * Lifecycle:
 * 1. On mount: check if biometrics are available + pref set.
 *    - If available and pref unset → show opt-in prompt.
 *    - If enabled → trigger unlock immediately.
 *    - Otherwise → pass through.
 * 2. On background → foreground transition after ≥5 min → require re-auth.
 */
export function BiometricGate({ children }: Props): React.JSX.Element {
  const [initState, setInitState] = useState<InitState>('checking');
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const canUse = await biometricUnlockService.canUseBiometrics();
      if (!canUse) {
        setInitState('ready');
        return;
      }

      const isEnabled = await biometricUnlockService.isBiometricEnabled();
      // `isBiometricEnabled` returns false for both "disabled" and "never set"
      // We distinguish by checking SecureStore directly is overkill;
      // instead we rely on: if canUse and value is exactly null (first launch) → opt-in
      const raw = await getRawPref();
      if (raw === null) {
        // First launch with biometrics available → show opt-in
        setInitState('opt-in');
        return;
      }

      if (isEnabled) {
        // Pref is enabled → lock on start
        setLocked(true);
      }
      setInitState('ready');
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active') {
        const bg = backgroundedAt.current;
        if (bg !== null && Date.now() - bg >= BACKGROUND_TIMEOUT_MS) {
          void biometricUnlockService.isBiometricEnabled().then((enabled) => {
            if (enabled) {
              setLocked(true);
            }
          });
        }
        backgroundedAt.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (initState === 'checking') {
    return <></>;
  }

  if (initState === 'opt-in') {
    return (
      <BiometricOptInPrompt
        onDone={() => {
          setInitState('ready');
        }}
      />
    );
  }

  return (
    <>
      {children}
      <BiometricPromptOverlay
        visible={locked}
        onSuccess={() => {
          setLocked(false);
        }}
      />
    </>
  );
}

/** Read the raw preference value from SecureStore to distinguish null (unset) from false. */
async function getRawPref(): Promise<string | null> {
  const { default: SecureStore } = await import('expo-secure-store');
  return SecureStore.getItemAsync('pb_biometric_enabled');
}
