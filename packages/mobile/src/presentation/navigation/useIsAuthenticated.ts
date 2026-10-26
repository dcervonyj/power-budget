import { useSyncExternalStore } from 'react';

export interface AuthStateSource {
  isAuthenticated(): boolean;
  subscribe(listener: () => void): () => void;
}

/** True while a session exists; re-renders on login, logout and refresh failure. */
export function useIsAuthenticated(source: AuthStateSource): boolean {
  return useSyncExternalStore(source.subscribe.bind(source), source.isAuthenticated.bind(source));
}
