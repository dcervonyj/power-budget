import { describe, it, expect, beforeEach } from 'vitest';
import { OnboardingStore } from '../../application/onboarding/OnboardingStore.js';

describe('OnboardingStore', () => {
  let store: OnboardingStore;

  beforeEach(() => {
    store = new OnboardingStore();
  });

  it('initial step is language', () => {
    expect(store.currentStep).toBe('language');
  });

  it('isFirstStep is true at the start', () => {
    expect(store.isFirstStep).toBe(true);
  });

  it('next() advances to the next step', () => {
    store.next();
    expect(store.currentStep).toBe('currency');
    expect(store.isFirstStep).toBe(false);
  });

  it('next() advances through all steps in order', () => {
    store.next(); // currency
    store.next(); // interesting-currencies
    store.next(); // bank-connect
    store.next(); // create-plan
    expect(store.currentStep).toBe('create-plan');
    expect(store.isLastStep).toBe(true);
  });

  it('next() does not go beyond the last step', () => {
    store.goTo('create-plan');
    store.next();
    expect(store.currentStep).toBe('create-plan');
  });

  it('back() goes to the previous step', () => {
    store.next();
    store.back();
    expect(store.currentStep).toBe('language');
  });

  it('back() does not go before the first step', () => {
    store.back();
    expect(store.currentStep).toBe('language');
  });

  it('skip() advances to next step', () => {
    store.skip();
    expect(store.currentStep).toBe('currency');
  });

  it('goTo() jumps to specific step', () => {
    store.goTo('bank-connect');
    expect(store.currentStep).toBe('bank-connect');
  });

  it('setLanguage() updates selectedLanguage', () => {
    store.setLanguage('uk');
    expect(store.selectedLanguage).toBe('uk');
  });

  it('setBaseCurrency() updates baseCurrency', () => {
    store.setBaseCurrency('EUR');
    expect(store.baseCurrency).toBe('EUR');
  });

  it('setInterestingCurrencies() updates interestingCurrencies', () => {
    store.setInterestingCurrencies(['USD', 'GBP']);
    expect(store.interestingCurrencies).toEqual(['USD', 'GBP']);
  });

  it('currentStepIndex is 0 at start', () => {
    expect(store.currentStepIndex).toBe(0);
  });

  it('currentStepIndex updates after next()', () => {
    store.next();
    expect(store.currentStepIndex).toBe(1);
  });
});
