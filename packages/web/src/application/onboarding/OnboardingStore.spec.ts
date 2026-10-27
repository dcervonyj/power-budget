import { describe, expect, it } from 'vitest';
import { OnboardingStore } from './OnboardingStore.js';

describe('OnboardingStore', () => {
  it('walks the five steps in order and back', () => {
    const store = new OnboardingStore();

    expect(store.currentStep).toBe('language');
    expect(store.isFirstStep).toBe(true);
    store.next();
    store.next();
    expect(store.currentStep).toBe('interesting-currencies');
    store.back();
    expect(store.currentStep).toBe('currency');
  });

  it('stays on the first and last step instead of running past them', () => {
    const store = new OnboardingStore();
    store.back();
    expect(store.currentStep).toBe('language');

    store.goTo('create-plan');
    store.next();
    expect(store.currentStep).toBe('create-plan');
    expect(store.isLastStep).toBe(true);
  });

  it('records which optional steps were skipped', () => {
    const store = new OnboardingStore();
    store.goTo('bank-connect');
    store.skip();
    expect(store.bankConnectSkipped).toBe(true);
    expect(store.currentStep).toBe('create-plan');

    store.skip();
    expect(store.createPlanSkipped).toBe(true);
  });

  it('drops the new base currency from the tracked currencies', () => {
    const store = new OnboardingStore();
    store.toggleInterestingCurrency('EUR');
    store.toggleInterestingCurrency('GBP');

    store.setBaseCurrency('EUR');

    expect(store.interestingCurrencies).toEqual(['GBP']);
  });

  it('keeps at most five tracked currencies', () => {
    const store = new OnboardingStore();
    for (const code of ['EUR', 'GBP', 'PLN', 'UAH', 'CHF', 'CZK']) {
      store.toggleInterestingCurrency(code);
    }

    expect(store.interestingCurrencies).toEqual(['EUR', 'GBP', 'PLN', 'UAH', 'CHF']);
    store.toggleInterestingCurrency('GBP');
    expect(store.interestingCurrencies).toEqual(['EUR', 'PLN', 'UAH', 'CHF']);
  });
});
