import { makeAutoObservable } from 'mobx';
import { readApiError, type PlansApi } from '@power-budget/shared-app';
import type { PlanDto, PlanPeriodKindDto, PlanTypeDto } from '@power-budget/shared-app/contract';
import {
  defaultNewPlanDraft,
  hasNewPlanErrors,
  toCreatePlanDto,
  validateNewPlanDraft,
  monthlyEndDate,
  weeklyEndDate,
  type NewPlanDraft,
  type NewPlanErrors,
} from './NewPlanDraft.js';

/** 409 is `duplicate` (an active plan of this type already covers the period); 400 is `invalid`. */
export type CreatePlanError = 'duplicate' | 'invalid' | 'failed';

export type CreatePlanApi = Pick<PlansApi, 'create'>;

/**
 * The create-plan form: the draft, its field errors and the submit. The household type is
 * offered only to a household member, and any member may create a household plan (D1).
 */
export class CreatePlanStore {
  draft: NewPlanDraft;
  errors: NewPlanErrors = {};
  submitting = false;
  submitError: CreatePlanError | null = null;

  private readonly plans: CreatePlanApi;
  private readonly hasHousehold: boolean;

  constructor(plans: CreatePlanApi, hasHousehold: boolean, today: Date, profileCurrency: string) {
    this.plans = plans;
    this.hasHousehold = hasHousehold;
    this.draft = defaultNewPlanDraft(today, profileCurrency);
    makeAutoObservable<CreatePlanStore, 'plans' | 'hasHousehold'>(this, {
      plans: false,
      hasHousehold: false,
    });
  }

  get typeOptions(): readonly PlanTypeDto[] {
    return this.hasHousehold ? ['personal', 'household'] : ['personal'];
  }

  /** The end date shown for a weekly or monthly period; empty for a custom one. */
  get derivedEndDate(): string {
    switch (this.draft.periodKind) {
      case 'weekly':
        return weeklyEndDate(this.draft.startDate);
      case 'monthly':
        return monthlyEndDate(this.draft.startDate);
      case 'custom':
        return '';
    }
  }

  setName(name: string): void {
    this.change({ name });
  }

  setType(type: PlanTypeDto): void {
    if (this.typeOptions.includes(type)) {
      this.change({ type });
    }
  }

  setPeriodKind(periodKind: PlanPeriodKindDto): void {
    this.change({ periodKind });
  }

  setStartDate(startDate: string): void {
    this.change({ startDate });
  }

  setEndDate(endDate: string): void {
    this.change({ endDate });
  }

  setBaseCurrency(baseCurrency: string): void {
    this.change({ baseCurrency });
  }

  /** The created plan, or null when a field is invalid or the API refused (see the errors). */
  async submit(): Promise<PlanDto | null> {
    this.errors = validateNewPlanDraft(this.draft);
    this.submitError = null;
    if (hasNewPlanErrors(this.errors)) {
      return null;
    }
    this.submitting = true;
    try {
      return await this.plans.create(toCreatePlanDto(this.draft));
    } catch (err) {
      this.submitError = classifyCreateError(err);

      return null;
    } finally {
      this.submitting = false;
    }
  }

  private change(patch: Partial<NewPlanDraft>): void {
    this.draft = { ...this.draft, ...patch };
    this.submitError = null;
    if (hasNewPlanErrors(this.errors)) {
      this.errors = validateNewPlanDraft(this.draft);
    }
  }
}

function classifyCreateError(err: unknown): CreatePlanError {
  const { status } = readApiError(err);
  if (status === 409) {
    return 'duplicate';
  }

  return status === 400 ? 'invalid' : 'failed';
}
