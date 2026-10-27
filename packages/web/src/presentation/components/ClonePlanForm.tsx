import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { PlanPeriodKindDto } from '@power-budget/shared-app/contract';
import { CustomPeriodPicker, type CustomPeriodValue } from './CustomPeriodPicker.js';
import { Select } from './Select.js';
import { ErrorBanner } from './shared/ErrorBanner.js';

export interface ClonePlanFormProps {
  readonly period: PlanPeriodKindDto;
  readonly customDates: CustomPeriodValue;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onPeriodChange: (period: PlanPeriodKindDto) => void;
  readonly onCustomDatesChange: (dates: CustomPeriodValue) => void;
}

/** The fields of the clone dialog; props only, so the gallery can render every state. */
export function ClonePlanForm({
  period,
  customDates,
  loading,
  error,
  onPeriodChange,
  onCustomDatesChange,
}: ClonePlanFormProps): React.JSX.Element {
  const intl = useIntl();
  const periodOptions: ReadonlyArray<{ value: PlanPeriodKindDto; label: string }> = [
    {
      value: 'weekly',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodWeekly',
        defaultMessage: 'Weekly',
      }),
    },
    {
      value: 'monthly',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodMonthly',
        defaultMessage: 'Monthly',
      }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodCustom',
        defaultMessage: 'Custom',
      }),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-md)' }}>
      <Select<PlanPeriodKindDto>
        id="clone-period"
        label={intl.formatMessage({
          id: 'modal.clonePlan.periodLabel',
          defaultMessage: 'Period',
        })}
        options={periodOptions}
        value={period}
        onChange={onPeriodChange}
      />
      {period === 'custom' && (
        <CustomPeriodPicker value={customDates} onChange={onCustomDatesChange} />
      )}
      {error !== null && <ErrorBanner message={error} />}
      {loading && (
        <span style={{ color: 'var(--pb-glass-dim)', fontSize: 'var(--pb-glass-type-small-web)' }}>
          <FormattedMessage id="modal.clonePlan.cloning" defaultMessage="Cloning…" />
        </span>
      )}
    </div>
  );
}
