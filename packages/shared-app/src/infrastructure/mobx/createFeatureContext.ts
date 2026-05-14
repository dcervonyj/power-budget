import { createContext, useContext } from 'react';

export function createFeatureContext<C>() {
  const Context = createContext<C | null>(null);

  function useFeatureContext(): C {
    const ctx = useContext(Context);
    if (!ctx)
      throw new Error('Feature context not found. Did you forget to wrap with the provider?');
    return ctx;
  }

  return { Context, useFeatureContext };
}
