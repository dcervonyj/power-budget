import { useSyncExternalStore } from 'react';

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function subscribeTo(query: string, onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);

  return () => list.removeEventListener('change', onChange);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeTo(query, onChange),
    () => matches(query),
    () => false,
  );
}
