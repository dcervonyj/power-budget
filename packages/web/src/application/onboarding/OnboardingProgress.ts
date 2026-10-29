import type { SessionScoped } from '../auth/ClientSession.js';
import { OnboardingStore } from './OnboardingStore.js';

/**
 * Keeps the wizard's answers while the user leaves it for the bank or plan screens (its "Connect
 * now" and "Create plan" links) and comes back, so a fresh wizard does not start over at step 1.
 * Cleared when onboarding is completed and when the session ends.
 */
export class OnboardingProgress implements SessionScoped {
  private current: OnboardingStore | null = null;

  /** The wizard in progress, or a new one when none has been started. */
  resume(): OnboardingStore {
    if (this.current === null) {
      this.current = new OnboardingStore();
    }

    return this.current;
  }

  clear(): void {
    this.current = null;
  }

  resetSession(): void {
    this.clear();
  }
}
