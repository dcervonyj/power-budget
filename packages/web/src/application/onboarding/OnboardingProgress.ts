import type { SessionScoped } from '../auth/ClientSession.js';
import { OnboardingStore } from './OnboardingStore.js';

/**
 * Keeps the wizard's answers while the user leaves it for the bank or plan screens (its "Connect
 * now" and "Create plan" links) and comes back, so a fresh wizard does not start over at step 1.
 * Cleared when onboarding is completed and when the session ends.
 */
export class OnboardingProgress implements SessionScoped {
  private current: OnboardingStore | null = null;
  private leftForLink = false;

  /** The wizard in progress, or a new one when none has been started. */
  resume(): OnboardingStore {
    this.leftForLink = false;
    if (this.current === null) {
      this.current = new OnboardingStore();
    }

    return this.current;
  }

  /** The wizard sends the user to the bank or plan screens through one of its own links. */
  leaveForLink(): void {
    if (this.current !== null) {
      this.leftForLink = true;
    }
  }

  /**
   * True from the moment the wizard's own link was followed until the wizard is shown again. A
   * direct URL to those screens never sets it, so it cannot be used to skip onboarding.
   */
  get isLeftForLink(): boolean {
    return this.leftForLink;
  }

  clear(): void {
    this.current = null;
    this.leftForLink = false;
  }

  resetSession(): void {
    this.clear();
  }
}
