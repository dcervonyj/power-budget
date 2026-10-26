import { describe, expect, it, vi } from 'vitest';
import { ReactNavigationAdapter } from '../ReactNavigationAdapter.js';

function setup(): { adapter: ReactNavigationAdapter; navigate: ReturnType<typeof vi.fn> } {
  const navigate = vi.fn();
  const adapter = new ReactNavigationAdapter();
  adapter.setRef({ navigate, goBack: vi.fn() });

  return { adapter, navigate };
}

describe('ReactNavigationAdapter', () => {
  it('navigates to auth screens through the Auth navigator', () => {
    const { adapter, navigate } = setup();

    adapter.navigate({ type: 'auth/login' });

    expect(navigate).toHaveBeenCalledWith('Auth', { screen: 'Login' });
  });

  it('navigates to tab screens through App > Tabs with nested params', () => {
    const { adapter, navigate } = setup();

    adapter.navigate({ type: 'dashboard', planId: 'p1' });

    expect(navigate).toHaveBeenCalledWith('App', {
      screen: 'Tabs',
      params: { screen: 'Dashboard', params: { planId: 'p1' } },
    });
  });

  it('navigates to app stack screens through App', () => {
    const { adapter, navigate } = setup();

    adapter.navigate({ type: 'plans/editor', planId: 'p2' });

    expect(navigate).toHaveBeenCalledWith('App', {
      screen: 'PlanEditor',
      params: { planId: 'p2' },
    });
  });
});
