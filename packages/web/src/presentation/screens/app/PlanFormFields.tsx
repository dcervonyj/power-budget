import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '../../components/ThemeContext.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { CustomPeriodPicker } from '../../components/CustomPeriodPicker.js';
import type { Plan, PlanPeriod } from './usePlanEditor.js';

interface PlanFormFieldsProps {
  plan: Plan;
  onNameChange: (value: string) => void;
  onPeriodChange: (period: PlanPeriod) => Promise<void>;
  onCustomDatesChange: (dates: { startDate: string; endDate: string }) => Promise<void>;
  onBaseCurrencyChange: (value: string) => void;
}

export function PlanFormFields({
  plan,
  onNameChange,
  onPeriodChange,
  onCustomDatesChange,
  onBaseCurrencyChange,
}: PlanFormFieldsProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const periodOptions: ReadonlyArray<{ value: PlanPeriod; label: string }> = [
    {
      value: 'weekly',
      label: intl.formatMessage({ id: 'screen.planEditor.periodWeekly', defaultMessage: 'Weekly' }),
    },
    {
      value: 'monthly',
      label: intl.formatMessage({
        id: 'screen.planEditor.periodMonthly',
        defaultMessage: 'Monthly',
      }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({ id: 'screen.planEditor.periodCustom', defaultMessage: 'Custom' }),
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.lg,
        marginBottom: theme.space['2xl'],
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.md,
        padding: theme.space.xl,
        border: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <Input
        id="plan-name"
        label={intl.formatMessage({
          id: 'screen.planEditor.namePlaceholder',
          defaultMessage: 'Plan name',
        })}
        placeholder={intl.formatMessage({
          id: 'screen.planEditor.namePlaceholder',
          defaultMessage: 'Plan name',
        })}
        value={plan.name}
        onChange={onNameChange}
      />

      <Select<PlanPeriod>
        id="plan-period"
        label={intl.formatMessage({
          id: 'screen.planEditor.periodLabel',
          defaultMessage: 'Period',
        })}
        options={periodOptions}
        value={plan.period}
        onChange={(val) => {
          void onPeriodChange(val);
        }}
      />

      {plan.period === 'custom' && (
        <CustomPeriodPicker
          value={{
            startDate: plan.startDate ?? '',
            endDate: plan.endDate ?? '',
          }}
          onChange={(dates) => {
            void onCustomDatesChange(dates);
          }}
        />
      )}

      <Input
        id="plan-base-currency"
        label={intl.formatMessage({
          id: 'screen.planEditor.baseCurrencyLabel',
          defaultMessage: 'Base currency',
        })}
        placeholder={intl.formatMessage({
          id: 'screen.planEditor.baseCurrencyPlaceholder',
          defaultMessage: 'e.g. USD',
        })}
        value={plan.baseCurrency}
        onChange={onBaseCurrencyChange}
      />
    </div>
  );
}
