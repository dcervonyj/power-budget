import { afterEach, describe, expect, it, vi } from 'vitest';
import { endSession, navigationAdapter } from '../AppProviders.js';
import { clientSession } from '../application/auth/ClientSession.js';

describe('endSession (the API client gave up on the session)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forgets the user's data like sign-out does, then goes to the login screen", () => {
    const end = vi.spyOn(clientSession, 'end').mockReturnValue(undefined);
    const navigate = vi.spyOn(navigationAdapter, 'replace').mockReturnValue(undefined);

    endSession();

    expect(end).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ type: 'auth/login', returnToCurrent: true });
    expect(end.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0] ?? 0);
  });
});
