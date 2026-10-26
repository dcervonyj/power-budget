import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useGlass } from './theme/index.js';

export interface AuthGateProps {
  readonly loadTokens: () => Promise<void>;
  readonly children: React.ReactNode;
}

/**
 * Holds the navigator back until the SecureStore tokens are in the in-memory cache, so the
 * first render already knows whether a session exists (no login-screen flash). A failed read
 * is treated as signed out.
 */
export function AuthGate({ loadTokens, children }: AuthGateProps): React.JSX.Element {
  const glass = useGlass();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadTokens()
      .catch((error: unknown) => {
        console.warn('Failed to load stored tokens', error);
      })
      .finally(() => {
        setReady(true);
      });
  }, [loadTokens]);

  if (!ready) {
    return (
      <View testID="auth-gate-loading" style={{ flex: 1, backgroundColor: glass.colors.base }} />
    );
  }

  return <>{children}</>;
}
