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
});
