import { describe, expect, it } from 'vitest';
import { OnboardingProgress } from './OnboardingProgress.js';

describe('OnboardingProgress', () => {
  it('hands back the same wizard until it is cleared', () => {
    const progress = new OnboardingProgress();
    const first = progress.resume();
    first.next();

    expect(progress.resume()).toBe(first);
    expect(progress.resume().currentStep).toBe('currency');

    progress.clear();

    expect(progress.resume()).not.toBe(first);
    expect(progress.resume().currentStep).toBe('language');
  });

  it('forgets the wizard when the session ends', () => {
    const progress = new OnboardingProgress();
    const first = progress.resume();

    progress.resetSession();

    expect(progress.resume()).not.toBe(first);
  });

  it('is not away from the wizard until the wizard link is followed, and not before it started', () => {
    const progress = new OnboardingProgress();

    progress.leaveForLink();
    expect(progress.isLeftForLink).toBe(false);

    progress.resume();
    expect(progress.isLeftForLink).toBe(false);

    progress.leaveForLink();
    expect(progress.isLeftForLink).toBe(true);
  });

  it('is back at the wizard when it is shown again, and after clear or session end', () => {
    const progress = new OnboardingProgress();
    progress.resume();
    progress.leaveForLink();

    progress.resume();
    expect(progress.isLeftForLink).toBe(false);

    progress.leaveForLink();
    progress.clear();
    expect(progress.isLeftForLink).toBe(false);

    progress.resume();
    progress.leaveForLink();
    progress.resetSession();
    expect(progress.isLeftForLink).toBe(false);
  });
});
