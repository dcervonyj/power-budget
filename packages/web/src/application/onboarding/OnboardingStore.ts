import { makeAutoObservable } from 'mobx';

export type OnboardingStep =
  | 'language'
  | 'currency'
  | 'interesting-currencies'
  | 'bank-connect'
  | 'create-plan';

export class OnboardingStore {
  currentStep: OnboardingStep = 'language';
  selectedLanguage: string = navigator.language.slice(0, 2) || 'en';
  baseCurrency: string = 'USD';
  interestingCurrencies: string[] = [];
  bankConnectSkipped: boolean = false;
  createPlanSkipped: boolean = false;

  readonly steps: OnboardingStep[] = [
    'language',
    'currency',
    'interesting-currencies',
    'bank-connect',
    'create-plan',
  ];

  constructor() {
    makeAutoObservable(this);
  }

  get currentStepIndex(): number {
    return this.steps.indexOf(this.currentStep);
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.steps.length - 1;
  }

  get isFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  setLanguage(lang: string): void {
    this.selectedLanguage = lang;
  }

  setBaseCurrency(currency: string): void {
    this.baseCurrency = currency;
  }

  setInterestingCurrencies(currencies: string[]): void {
    this.interestingCurrencies = currencies;
  }

  next(): void {
    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex < this.steps.length) {
      this.currentStep = this.steps[nextIndex]!;
    }
  }

  back(): void {
    const prevIndex = this.currentStepIndex - 1;
    if (prevIndex >= 0) {
      this.currentStep = this.steps[prevIndex]!;
    }
  }

  skip(): void {
    this.next();
  }

  goTo(step: OnboardingStep): void {
    this.currentStep = step;
  }
}
