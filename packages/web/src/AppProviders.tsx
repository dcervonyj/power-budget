import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalStorageTokenStore } from './infrastructure/tokens/LocalStorageTokenStore.js';
import { ReactRouterNavigationAdapter } from './infrastructure/navigation/ReactRouterNavigationAdapter.js';
import { createApiClient } from './infrastructure/api/ApiClient.js';

export interface AppProvidersProps {
  children: React.ReactNode;
}

// Singleton infrastructure adapters — created once, wired at runtime.
export const tokenStore = new LocalStorageTokenStore();
export const navigationAdapter = new ReactRouterNavigationAdapter();
export const apiClient = createApiClient(tokenStore, () => {
  navigationAdapter.navigate({ type: 'auth/login' });
});

/**
 * Inner component that has access to the router context and wires up the
 * navigation adapter's imperative navigate function.
 */
function NavigationWirer(): null {
  const navigate = useNavigate();
  const adapterRef = useRef(navigationAdapter);

  useEffect(() => {
    adapterRef.current.setNavigate(navigate);
  }, [navigate]);

  return null;
}

/**
 * AppProviders is the composition root for the web app.
 * It wires platform-specific adapters to shared-app context factories and
 * exposes them via React context. Feature contexts are added in WEB-005+.
 */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  return (
    <>
      <NavigationWirer />
      {children}
    </>
  );
}
