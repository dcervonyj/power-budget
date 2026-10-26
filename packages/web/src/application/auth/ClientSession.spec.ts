import { describe, expect, it, vi } from 'vitest';
import { ClientSession, type SessionScoped } from './ClientSession.js';

function scoped(): SessionScoped {
  return { resetSession: vi.fn() };
}

describe('ClientSession', () => {
  it('resets every registered store when the session ends', () => {
    const session = new ClientSession();
    const dashboard = scoped();
    const settings = scoped();
    session.register(dashboard);
    session.register(settings);

    session.end();

    expect(dashboard.resetSession).toHaveBeenCalledOnce();
    expect(settings.resetSession).toHaveBeenCalledOnce();
  });

  it('resets a store registered twice only once', () => {
    const session = new ClientSession();
    const store = scoped();
    session.register(store);
    session.register(store);

    session.end();

    expect(store.resetSession).toHaveBeenCalledOnce();
  });
});
