/** Anything that holds data of the signed-in user and must forget it when the session ends. */
export interface SessionScoped {
  resetSession(): void;
}

/**
 * The client side of a session. Sign-out and session end (refresh failed) call `end()`,
 * which resets every registered store and storage, so the next user in the same tab
 * sees nothing of the previous one (audit FE-BUGS-01).
 */
export class ClientSession {
  private readonly scoped: SessionScoped[] = [];

  register(scoped: SessionScoped): void {
    if (!this.scoped.includes(scoped)) {
      this.scoped.push(scoped);
    }
  }

  end(): void {
    for (const scoped of this.scoped) {
      scoped.resetSession();
    }
  }
}

/**
 * The app's session. It has no dependencies, so the store modules (which the composition
 * root cannot import without a cycle) register themselves when they are created.
 */
export const clientSession = new ClientSession();
