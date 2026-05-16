import { describe, it, expect } from 'vitest';
import { createFeatureContext } from '../infrastructure/mobx/createFeatureContext.js';

describe('createFeatureContext()', () => {
  it('returns Context and useFeatureContext', () => {
    const result = createFeatureContext<{ value: number }>();
    expect(result.Context).toBeDefined();
    expect(typeof result.useFeatureContext).toBe('function');
  });

  it('Context has displayName behaviour — is a valid React context object', () => {
    const { Context } = createFeatureContext<{ name: string }>();
    expect(Context).toHaveProperty('Provider');
    expect(Context).toHaveProperty('Consumer');
  });

  it('useFeatureContext throws when called outside a Provider', () => {
    const { useFeatureContext } = createFeatureContext<{ x: number }>();
    expect(() => useFeatureContext()).toThrow();
  });
});
