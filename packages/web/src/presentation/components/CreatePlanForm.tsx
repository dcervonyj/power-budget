import React from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import { CURRENCIES } from '@power-budget/core';
import type { SelectOption } from '@power-budget/shared-app';
import type { PlanPeriodKindDto, PlanTypeDto } from '@power-budget/shared-app/contract';
import type { CreatePlanError } from '../../application/plans/CreatePlanStore.js';
import type { NewPlanDraft, NewPlanErrors } from '../../application/plans/NewPlanDraft.js';
import { CustomPeriodPicker } from './CustomPeriodPicker.js';
import { Input } from './Input.js';
import { Select } from './Select.js';
import { ErrorBanner } from './shared/ErrorBanner.js';

export interface CreatePlanFormProps {
  readonly draft: NewPlanDraft;
  readonly errors: NewPlanErrors;
  readonly typeOptions: readonly PlanTypeDto[];
  /** The weekly or monthly end date, derived from the start. */
  readonly derivedEndDate: string;
  readonly submitError: CreatePlanError | null;
  readonly onNameChange: (name: string) => void;
  readonly onTypeChange: (type: PlanTypeDto) => void;
  readonly onPeriodKindChange: (periodKind: PlanPeriodKindDto) => void;
  readonly onStartDateChange: (startDate: string) => void;
  readonly onEndDateChange: (endDate: string) => void;
  readonly onBaseCurrencyChange: (currency: string) => void;
}

const CURRENCY_OPTIONS: ReadonlyArray<SelectOption> = Object.keys(CURRENCIES).map(toCurrencyOption);

/** The fields of the create-plan dialog; props only, so the gallery can render every state. */
export function CreatePlanForm({
  draft,
  errors,
  typeOptions,
  derivedEndDate,
  submitError,
  onNameChange,
  onTypeChange,
  onPeriodKindChange,
  onStartDateChange,
  onEndDateChange,
  onBaseCurrencyChange,
}: CreatePlanFormProps): React.JSX.Element {
  const intl = useIntl();
  const derived = draft.periodKind !== 'custom';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-md)' }}>
      <Input
        id="create-plan-name"
        label={intl.formatMessage({
          id: 'modal.createPlan.nameLabel',
          defaultMessage: 'Plan name',
        })}
        value={draft.name}
        error={nameMessage(intl, errors)}
        onChange={onNameChange}
      />
      <Select<PlanTypeDto>
        id="create-plan-type"
        label={intl.formatMessage({ id: 'modal.createPlan.typeLabel', defaultMessage: 'Type' })}
        options={typeOptions.map((type) => toTypeOption(intl, type))}
        value={draft.type}
        onChange={onTypeChange}
      />
      <Select<PlanPeriodKindDto>
        id="create-plan-period"
        label={intl.formatMessage({
          id: 'modal.createPlan.periodLabel',
          defaultMessage: 'Period',
        })}
        options={periodOptions(intl)}
        value={draft.periodKind}
        onChange={onPeriodKindChange}
      />
      <CustomPeriodPicker
        value={{ startDate: draft.startDate, endDate: derived ? derivedEndDate : draft.endDate }}
        onChange={(value) => {
          onStartDateChange(value.startDate);
          if (!derived) {
            onEndDateChange(value.endDate);
          }
        }}
        startError={startMessage(intl, errors)}
        endError={endMessage(intl, errors)}
        endDisabled={derived}
      />
      <Select
        id="create-plan-currency"
        label={intl.formatMessage({
          id: 'modal.createPlan.currencyLabel',
          defaultMessage: 'Base currency',
        })}
        options={CURRENCY_OPTIONS}
        value={draft.baseCurrency}
        onChange={onBaseCurrencyChange}
      />
      {errors.baseCurrency !== undefined && (
        <ErrorBanner
          message={intl.formatMessage({
            id: 'modal.createPlan.error.currency',
            defaultMessage: 'Choose a supported currency',
          })}
        />
      )}
      {submitError !== null && <ErrorBanner message={submitMessage(intl, submitError)} />}
    </div>
  );
}

function toCurrencyOption(code: string): SelectOption {
  return { value: code, label: code };
}

function toTypeOption(intl: IntlShape, type: PlanTypeDto): SelectOption<PlanTypeDto> {
  return {
    value: type,
    label:
      type === 'household'
        ? intl.formatMessage({
            id: 'modal.createPlan.typeHousehold',
            defaultMessage: 'Household',
          })
        : intl.formatMessage({ id: 'modal.createPlan.typePersonal', defaultMessage: 'Personal' }),
  };
}

function periodOptions(intl: IntlShape): ReadonlyArray<SelectOption<PlanPeriodKindDto>> {
  return [
    {
      value: 'monthly',
      label: intl.formatMessage({
        id: 'modal.createPlan.periodMonthly',
        defaultMessage: 'Monthly',
      }),
    },
    {
      value: 'weekly',
      label: intl.formatMessage({ id: 'modal.createPlan.periodWeekly', defaultMessage: 'Weekly' }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({ id: 'modal.createPlan.periodCustom', defaultMessage: 'Custom' }),
    },
  ];
}

function nameMessage(intl: IntlShape, errors: NewPlanErrors): string | undefined {
  switch (errors.name) {
    case undefined:
      return undefined;
    case 'required':
      return intl.formatMessage({
        id: 'modal.createPlan.error.nameRequired',
        defaultMessage: 'Enter a plan name',
      });
    case 'too_long':
      return intl.formatMessage({
        id: 'modal.createPlan.error.nameTooLong',
        defaultMessage: 'The name can be at most 255 characters',
      });
  }
}

function startMessage(intl: IntlShape, errors: NewPlanErrors): string | undefined {
  return errors.startDate === undefined
    ? undefined
    : intl.formatMessage({
        id: 'modal.createPlan.error.startRequired',
        defaultMessage: 'Choose a start date',
      });
}

function endMessage(intl: IntlShape, errors: NewPlanErrors): string | undefined {
  switch (errors.endDate) {
    case undefined:
      return undefined;
    case 'required':
      return intl.formatMessage({
        id: 'modal.createPlan.error.endRequired',
        defaultMessage: 'Choose an end date',
      });
    case 'not_after_start':
      return intl.formatMessage({
        id: 'modal.createPlan.error.endNotAfterStart',
        defaultMessage: 'The end date must be after the start date',
      });
  }
}

function submitMessage(intl: IntlShape, error: CreatePlanError): string {
  switch (error) {
    case 'duplicate':
      return intl.formatMessage({
        id: 'modal.createPlan.error.duplicate',
        defaultMessage:
          'You already have an active plan of this type for these dates. Archive it or choose other dates.',
      });
    case 'invalid':
      return intl.formatMessage({
        id: 'modal.createPlan.error.invalid',
        defaultMessage: 'The plan details are not valid. Check the fields and try again.',
      });
    case 'failed':
      return intl.formatMessage({
        id: 'modal.createPlan.error.failed',
        defaultMessage: 'Failed to create plan',
      });
  }
}
