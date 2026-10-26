import { useIntl } from 'react-intl';
import { formatAmount } from '../../i18n/formatAmount.js';
import type { MoneyAmount } from '../../../domain/dashboard/PlanDashboard.js';

export interface LightLabels {
  lensAria(perDay: MoneyAmount, daysLeft: number): string;
  lensUnit(currencySymbol: string): string;
  daysLeft(daysLeft: number): string;
  rodAria(
    name: string,
    state: 'under' | 'over' | 'paid' | 'empty',
    amount: MoneyAmount,
    plan: MoneyAmount,
  ): string;
  rodTag(state: 'over' | 'paid'): string;
  tubeAria(name: string, saved: MoneyAmount, goal: MoneyAmount): string;
}

/** i18n strings for the light primitives (glass-light.* messages); amounts go through formatAmount. */
export function useLightLabels(): LightLabels {
  const intl = useIntl();

  return {
    lensAria(perDay, daysLeft) {
      return intl.formatMessage(
        {
          id: 'glass-light.lens.aria',
          defaultMessage: '{amount} a day, {days, plural, one {# day left} other {# days left}}',
        },
        { amount: formatAmount(perDay, intl.locale), days: daysLeft },
      );
    },
    lensUnit(currencySymbol) {
      return intl.formatMessage(
        { id: 'glass-light.lens.perDay', defaultMessage: '{currency} a day' },
        { currency: currencySymbol },
      );
    },
    daysLeft(daysLeft) {
      return intl.formatMessage(
        {
          id: 'glass-light.daysLeft',
          defaultMessage: '{days, plural, one {# day left} other {# days left}}',
        },
        { days: daysLeft },
      );
    },
    rodAria(name, state, amount, plan) {
      const values = {
        name,
        left: formatAmount(amount, intl.locale),
        plan: formatAmount(plan, intl.locale),
        over: formatAmount(amount, intl.locale),
      };
      if (state === 'over') {
        return intl.formatMessage(
          { id: 'glass-light.rod.aria.over', defaultMessage: '{name}: over by {over}' },
          values,
        );
      }
      if (state === 'paid') {
        return intl.formatMessage(
          { id: 'glass-light.rod.aria.paid', defaultMessage: '{name}: paid' },
          values,
        );
      }
      if (state === 'empty') {
        return intl.formatMessage(
          {
            id: 'glass-light.rod.aria.empty',
            defaultMessage: '{name}: nothing left of {plan}',
          },
          values,
        );
      }

      return intl.formatMessage(
        { id: 'glass-light.rod.aria.under', defaultMessage: '{name}: {left} left of {plan}' },
        values,
      );
    },
    rodTag(state) {
      if (state === 'paid') {
        return intl.formatMessage({ id: 'glass-light.rod.tag.paid', defaultMessage: 'Paid' });
      }

      return intl.formatMessage({
        id: 'glass-light.rod.tag.over',
        defaultMessage: 'Over budget',
      });
    },
    tubeAria(name, saved, goal) {
      return intl.formatMessage(
        { id: 'glass-light.tube.aria', defaultMessage: '{name}: {saved} of {goal}' },
        {
          name,
          saved: formatAmount(saved, intl.locale),
          goal: formatAmount(goal, intl.locale),
        },
      );
    },
  };
}
