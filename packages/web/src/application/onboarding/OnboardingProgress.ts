import { reaction } from 'mobx';
import type { ProgressStorage } from '../ports/ProgressStorage.js';
import type { SessionScoped } from '../auth/ClientSession.js';
import { OnboardingStore, type OnboardingStep } from './OnboardingStore.js';

export const ONBOARDING_PROGRESS_KEY = 'pb_onboarding_progress';

interface SavedProgress {
  readonly step: OnboardingStep;
  readonly language: string;
  readonly baseCurrency: string;
  readonly interestingCurrencies: readonly string[];
  readonly bankConnectSkipped: boolean;
  readonly createPlanSkipped: boolean;
  /** The wizard's bank or plan link was followed and the wizard has not been shown since. */
  readonly leftForLink: boolean;
}

/**
 * Keeps the wizard's answers while the user leaves it for the bank or plan screens (its "Connect
 * now" and "Create plan" links) and comes back, so a fresh wizard does not start over at step 1.
 * The progress and the "left through the wizard's link" marker are also kept in per-tab storage,
 * because the bank consent redirect and a reload restart the app. Only the wizard writes them;
 * they are cleared when onboarding is completed and when the session ends.
 */
export class OnboardingProgress implements SessionScoped {
  private current: OnboardingStore | null = null;
  private leftForLink = false;
  private restored = false;
  private stopSaving: (() => void) | null = null;

  constructor(private readonly storage: ProgressStorage) {}

  /** The wizard in progress, or a new one when none has been started. */
  resume(): OnboardingStore {
    this.restoreOnce();
    this.leftForLink = false;
    const store = this.current ?? this.start(new OnboardingStore());
    this.save(store);

    return store;
  }

  /** The wizard sends the user to the bank or plan screens through one of its own links. */
  leaveForLink(): void {
    this.restoreOnce();
    if (this.current !== null) {
      this.leftForLink = true;
      this.save(this.current);
    }
  }

  /**
   * True from the moment the wizard's own link was followed until the wizard is shown again. A
   * direct URL in a tab where the wizard never set it cannot be used to skip onboarding.
   */
  get isLeftForLink(): boolean {
    this.restoreOnce();

    return this.leftForLink;
  }

  clear(): void {
    this.stopSaving?.();
    this.stopSaving = null;
    this.current = null;
    this.leftForLink = false;
    this.restored = true;
    this.storage.removeItem(ONBOARDING_PROGRESS_KEY);
  }

  resetSession(): void {
    this.clear();
  }

  private restoreOnce(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    const saved = this.readSaved();
    if (saved === null) {
      return;
    }
    const store = new OnboardingStore();
    store.setLanguage(saved.language);
    store.setBaseCurrency(saved.baseCurrency);
    store.setInterestingCurrencies([...saved.interestingCurrencies]);
    store.bankConnectSkipped = saved.bankConnectSkipped;
    store.createPlanSkipped = saved.createPlanSkipped;
    store.goTo(saved.step);
    this.leftForLink = saved.leftForLink;
    this.start(store);
  }

  private start(store: OnboardingStore): OnboardingStore {
    this.current = store;
    this.stopSaving = reaction(
      () => this.serialize(store),
      (json) => {
        this.storage.setItem(ONBOARDING_PROGRESS_KEY, json);
      },
    );

    return store;
  }

  private save(store: OnboardingStore): void {
    this.storage.setItem(ONBOARDING_PROGRESS_KEY, this.serialize(store));
  }

  private serialize(store: OnboardingStore): string {
    const saved: SavedProgress = {
      step: store.currentStep,
      language: store.selectedLanguage,
      baseCurrency: store.baseCurrency,
      interestingCurrencies: [...store.interestingCurrencies],
      bankConnectSkipped: store.bankConnectSkipped,
      createPlanSkipped: store.createPlanSkipped,
      leftForLink: this.leftForLink,
    };

    return JSON.stringify(saved);
  }

  private readSaved(): SavedProgress | null {
    const raw = this.storage.getItem(ONBOARDING_PROGRESS_KEY);
    if (raw === null) {
      return null;
    }
    try {
      return parseSaved(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

const STEPS: readonly OnboardingStep[] = [
  'language',
  'currency',
  'interesting-currencies',
  'bank-connect',
  'create-plan',
];

function parseSaved(value: unknown): SavedProgress | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'step' in value &&
    'language' in value &&
    'baseCurrency' in value &&
    'interestingCurrencies' in value &&
    'bankConnectSkipped' in value &&
    'createPlanSkipped' in value &&
    'leftForLink' in value
  ) {
    return toSaved(value);
  }

  return null;
}

function toSaved(value: {
  step: unknown;
  language: unknown;
  baseCurrency: unknown;
  interestingCurrencies: unknown;
  bankConnectSkipped: unknown;
  createPlanSkipped: unknown;
  leftForLink: unknown;
}): SavedProgress | null {
  const step = STEPS.find((candidate) => candidate === value.step);
  const currencies = value.interestingCurrencies;
  if (
    step === undefined ||
    typeof value.language !== 'string' ||
    typeof value.baseCurrency !== 'string' ||
    !Array.isArray(currencies) ||
    !currencies.every(isString) ||
    typeof value.bankConnectSkipped !== 'boolean' ||
    typeof value.createPlanSkipped !== 'boolean' ||
    typeof value.leftForLink !== 'boolean'
  ) {
    return null;
  }

  return {
    step,
    language: value.language,
    baseCurrency: value.baseCurrency,
    interestingCurrencies: currencies,
    bankConnectSkipped: value.bankConnectSkipped,
    createPlanSkipped: value.createPlanSkipped,
    leftForLink: value.leftForLink,
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
