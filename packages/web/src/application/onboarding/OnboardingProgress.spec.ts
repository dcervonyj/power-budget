import { describe, expect, it } from 'vitest';
import type { ProgressStorage } from '../ports/ProgressStorage.js';
import { ONBOARDING_PROGRESS_KEY, OnboardingProgress } from './OnboardingProgress.js';

class MemoryProgressStorage implements ProgressStorage {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

class RefusingProgressStorage implements ProgressStorage {
  getItem(): string | null {
    return null;
  }

  setItem(): void {}

  removeItem(): void {}
}

function walkToBankStep(progress: OnboardingProgress): void {
  const wizard = progress.resume();
  wizard.setLanguage('pl');
  wizard.next();
  wizard.setBaseCurrency('EUR');
  wizard.next();
  wizard.toggleInterestingCurrency('USD');
  wizard.next();
}

describe('OnboardingProgress', () => {
  it('hands back the same wizard until it is cleared', () => {
    const progress = new OnboardingProgress(new MemoryProgressStorage());
    const first = progress.resume();
    first.next();

    expect(progress.resume()).toBe(first);
    expect(progress.resume().currentStep).toBe('currency');

    progress.clear();

    expect(progress.resume()).not.toBe(first);
    expect(progress.resume().currentStep).toBe('language');
  });

  it('is not away from the wizard until the wizard link is followed, and not before it started', () => {
    const progress = new OnboardingProgress(new MemoryProgressStorage());

    progress.leaveForLink();
    expect(progress.isLeftForLink).toBe(false);

    progress.resume();
    expect(progress.isLeftForLink).toBe(false);

    progress.leaveForLink();
    expect(progress.isLeftForLink).toBe(true);
  });

  it('round trip through the plan link: back at the same step with the same choices', () => {
    const progress = new OnboardingProgress(new MemoryProgressStorage());
    walkToBankStep(progress);
    progress.resume().skip();
    progress.leaveForLink();
    expect(progress.isLeftForLink).toBe(true);

    const wizard = progress.resume();

    expect(progress.isLeftForLink).toBe(false);
    expect(wizard.currentStep).toBe('create-plan');
    expect(wizard.bankConnectSkipped).toBe(true);
    expect(wizard.baseCurrency).toBe('EUR');
    expect(wizard.interestingCurrencies).toEqual(['USD']);
  });

  it('restores step, choices and the marker after a full reload or bank consent redirect', () => {
    const storage = new MemoryProgressStorage();
    const before = new OnboardingProgress(storage);
    walkToBankStep(before);
    before.leaveForLink();

    const afterReload = new OnboardingProgress(storage);

    expect(afterReload.isLeftForLink).toBe(true);
    const wizard = afterReload.resume();
    expect(wizard.currentStep).toBe('bank-connect');
    expect(wizard.selectedLanguage).toBe('pl');
    expect(wizard.baseCurrency).toBe('EUR');
    expect(wizard.interestingCurrencies).toEqual(['USD']);
    expect(afterReload.isLeftForLink).toBe(false);
  });

  it('saves each step as the wizard moves, so a reload without the link keeps it too', () => {
    const storage = new MemoryProgressStorage();
    const before = new OnboardingProgress(storage);
    before.resume().next();

    const afterReload = new OnboardingProgress(storage);

    expect(afterReload.resume().currentStep).toBe('currency');
    expect(afterReload.isLeftForLink).toBe(false);
  });

  it('forgets everything when onboarding is completed', () => {
    const storage = new MemoryProgressStorage();
    const progress = new OnboardingProgress(storage);
    walkToBankStep(progress);
    progress.leaveForLink();

    progress.clear();

    expect(storage.items.has(ONBOARDING_PROGRESS_KEY)).toBe(false);
    const afterReload = new OnboardingProgress(storage);
    expect(afterReload.isLeftForLink).toBe(false);
    expect(afterReload.resume().currentStep).toBe('language');
  });

  it('forgets everything when the session ends', () => {
    const storage = new MemoryProgressStorage();
    const progress = new OnboardingProgress(storage);
    const first = progress.resume();
    progress.leaveForLink();

    progress.resetSession();

    expect(storage.items.has(ONBOARDING_PROGRESS_KEY)).toBe(false);
    expect(progress.isLeftForLink).toBe(false);
    expect(progress.resume()).not.toBe(first);
  });

  it('does not treat a direct URL in a tab without the wizard marker as coming from the wizard', () => {
    const progress = new OnboardingProgress(new MemoryProgressStorage());

    expect(progress.isLeftForLink).toBe(false);
  });

  it('ignores stored progress that is not valid', () => {
    const storage = new MemoryProgressStorage();
    storage.setItem(ONBOARDING_PROGRESS_KEY, '{"step":"nowhere","leftForLink":true}');
    const corrupt = new OnboardingProgress(storage);
    expect(corrupt.isLeftForLink).toBe(false);

    storage.setItem(ONBOARDING_PROGRESS_KEY, 'not json');
    const garbage = new OnboardingProgress(storage);
    expect(garbage.isLeftForLink).toBe(false);
    expect(garbage.resume().currentStep).toBe('language');
  });

  it('still works for the page when storage refuses everything', () => {
    const progress = new OnboardingProgress(new RefusingProgressStorage());

    const wizard = progress.resume();
    wizard.next();
    progress.leaveForLink();

    expect(progress.resume().currentStep).toBe('currency');
  });
});
