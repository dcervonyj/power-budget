import { useIntl } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { toSupportedLocale } from '../../../glass/atoms/supportedLocale.js';
import {
  formatDayMonth,
  formatExactAmount,
  formatPercent,
  formatWholeAmount,
} from './overviewFormat.js';
import type { OverviewError } from './useOverviewData.js';

/** Above this the to-sort card says "99+". */
export const TO_SORT_MAX = 99;

export interface OverviewLabels {
  today(date: string, day: number, total: number): string;
  period(start: string, end: string): string;
  plans(): string;
  heroTitle(): string;
  leftOfPlanned(left: MinorUnitAmount, planned: MinorUnitAmount): string;
  lightHint(): string;
  overTag(): string;
  overExplanation(over: MinorUnitAmount, end: string): string;
  future(start: string): string;
  past(end: string): string;
  noPlannedExpenses(): string;
  spentTile(): string;
  incomeTile(): string;
  ofPlanned(planned: MinorUnitAmount): string;
  paceTitle(): string;
  paceKind(kind: 'under' | 'over'): string;
  planSpent(): string;
  monthGone(): string;
  percent(value: number): string;
  wholeAmount(money: MinorUnitAmount): string;
  paceAria(kind: 'under' | 'over', leftPercent: number, monthLeftPercent: number): string;
  monthLeftMark(percent: number): string;
  paceSummary(input: PaceSummaryInput): string;
  forecastLine(total: MinorUnitAmount, end: string): string;
  toSortTitle(count: number): string;
  toSortHint(): string;
  toSortAction(count: number): string;
  categoriesTitle(): string;
  categoriesLegend(): string;
  categoriesEmpty(): string;
  showAll(count: number): string;
  showFewer(): string;
  unplannedTitle(): string;
  unplannedHint(): string;
  noActivePlan(): string;
  noActivePlanHint(): string;
  createPlan(): string;
  error(error: OverviewError): string;
}

export interface PaceSummaryInput {
  readonly kind: 'under' | 'over';
  readonly points: number;
  readonly plan: string;
  readonly perDay: MinorUnitAmount;
  /** Plan minus forecast: positive closes under plan, negative over. */
  readonly versusPlan: MinorUnitAmount;
}

/** i18n strings of the Overview (overview.* messages, assets/locales/<locale>/overview.json). */
export function useOverviewLabels(): OverviewLabels {
  const intl = useIntl();
  const locale = toSupportedLocale(intl.locale);

  function amount(money: MinorUnitAmount): string {
    return formatExactAmount(money, locale);
  }

  function whole(money: MinorUnitAmount): string {
    return formatWholeAmount(money, locale, true);
  }

  function date(iso: string): string {
    return formatDayMonth(iso, locale, false);
  }

  return {
    today(iso, day, total) {
      return intl.formatMessage(
        { id: 'overview.header.today', defaultMessage: '{date} · day {day} of {total}' },
        {
          date: formatDayMonth(iso, locale, true),
          day,
          total,
        },
      );
    },
    period(start, end) {
      return intl.formatMessage(
        { id: 'overview.header.period', defaultMessage: '{start} – {end}' },
        { start: date(start), end: date(end) },
      );
    },
    plans() {
      return intl.formatMessage({ id: 'overview.plans.label', defaultMessage: 'Plans' });
    },
    heroTitle() {
      return intl.formatMessage({
        id: 'overview.hero.title',
        defaultMessage: 'Safe to spend today',
      });
    },
    leftOfPlanned(left, planned) {
      return intl.formatMessage(
        { id: 'overview.hero.leftOfPlanned', defaultMessage: '{left} left of {planned} planned' },
        { left: whole(left), planned: whole(planned) },
      );
    },
    lightHint() {
      return intl.formatMessage({
        id: 'overview.hero.lightHint',
        defaultMessage: 'The light is what is still in the plan; it fades as you spend.',
      });
    },
    overTag() {
      return intl.formatMessage({ id: 'overview.hero.overTag', defaultMessage: 'Over plan' });
    },
    overExplanation(over, end) {
      return intl.formatMessage(
        {
          id: 'overview.hero.overExplanation',
          defaultMessage:
            'Spending is past the plan by {amount}, so nothing is left to spend a day until {date}.',
        },
        { amount: amount(over), date: date(end) },
      );
    },
    future(start) {
      return intl.formatMessage(
        {
          id: 'overview.hero.future',
          defaultMessage: 'This plan starts on {date}. Safe to spend and pace appear once it runs.',
        },
        { date: date(start) },
      );
    },
    past(end) {
      return intl.formatMessage(
        { id: 'overview.hero.past', defaultMessage: 'This plan ended on {date}.' },
        { date: date(end) },
      );
    },
    noPlannedExpenses() {
      return intl.formatMessage({
        id: 'overview.hero.noPlan',
        defaultMessage: 'This plan has no planned expenses, so there is no daily amount to show.',
      });
    },
    spentTile() {
      return intl.formatMessage({ id: 'overview.tile.spent', defaultMessage: 'Spent so far' });
    },
    incomeTile() {
      return intl.formatMessage({ id: 'overview.tile.income', defaultMessage: 'Income' });
    },
    ofPlanned(planned) {
      return intl.formatMessage(
        { id: 'overview.tile.ofPlanned', defaultMessage: 'of {amount} planned' },
        { amount: whole(planned) },
      );
    },
    paceTitle() {
      return intl.formatMessage({ id: 'overview.pace.title', defaultMessage: 'Pace' });
    },
    paceKind(kind) {
      return kind === 'under'
        ? intl.formatMessage({ id: 'overview.pace.under', defaultMessage: 'Under pace' })
        : intl.formatMessage({ id: 'overview.pace.over', defaultMessage: 'Over pace' });
    },
    planSpent() {
      return intl.formatMessage({
        id: 'overview.pace.planSpent',
        defaultMessage: 'of the plan spent',
      });
    },
    monthGone() {
      return intl.formatMessage({
        id: 'overview.pace.monthGone',
        defaultMessage: 'of the month gone',
      });
    },
    wholeAmount(money) {
      return whole(money);
    },
    percent(value) {
      return formatPercent(value, intl.locale);
    },
    paceAria(kind, leftPercent, monthLeftPercent) {
      const values = {
        left: formatPercent(leftPercent, intl.locale),
        month: formatPercent(monthLeftPercent, intl.locale),
      };

      return kind === 'under'
        ? intl.formatMessage(
            {
              id: 'overview.pace.aria.under',
              defaultMessage:
                'Pace: {left} of the plan is still left as light, {month} of the month is still to come. The light reaches past the mark, so spending is under pace.',
            },
            values,
          )
        : intl.formatMessage(
            {
              id: 'overview.pace.aria.over',
              defaultMessage:
                'Pace: {left} of the plan is still left as light, {month} of the month is still to come. The light stops before the mark, so spending is over pace.',
            },
            values,
          );
    },
    monthLeftMark(percent) {
      return intl.formatMessage(
        { id: 'overview.pace.monthLeftMark', defaultMessage: 'Month left {percent}' },
        { percent: formatPercent(percent, intl.locale) },
      );
    },
    paceSummary({ kind, points, plan, perDay, versusPlan }) {
      const difference = {
        amountMinor: versusPlan.amountMinor < 0n ? -versusPlan.amountMinor : versusPlan.amountMinor,
        currency: versusPlan.currency,
      };
      const values = { points, plan, perDay: whole(perDay), amount: whole(difference) };
      if (kind === 'under') {
        return intl.formatMessage(
          {
            id: 'overview.pace.summaryUnder',
            defaultMessage:
              'Spending is {points, plural, one {# point} other {# points}} behind the calendar. At this pace {plan} closes about {amount} under plan. Up to {perDay} a day still keeps it within the plan.',
          },
          values,
        );
      }
      if (versusPlan.amountMinor < 0n) {
        return intl.formatMessage(
          {
            id: 'overview.pace.summaryOver',
            defaultMessage:
              'Spending is {points, plural, one {# point} other {# points}} ahead of the calendar. At this pace {plan} closes about {amount} over plan.',
          },
          values,
        );
      }

      return intl.formatMessage(
        {
          id: 'overview.pace.summaryOverStillUnder',
          defaultMessage:
            'Spending is {points, plural, one {# point} other {# points}} ahead of the calendar. At this pace {plan} still closes about {amount} under plan.',
        },
        values,
      );
    },
    forecastLine(total, end) {
      return intl.formatMessage(
        {
          id: 'overview.pace.forecast',
          defaultMessage: 'At this pace: ≈ {amount} spent by {date}',
        },
        { amount: whole(total), date: date(end) },
      );
    },
    toSortTitle(count) {
      if (count > TO_SORT_MAX) {
        return intl.formatMessage(
          { id: 'overview.toSort.titleMany', defaultMessage: '{max}+ to sort' },
          { max: TO_SORT_MAX },
        );
      }

      return intl.formatMessage(
        { id: 'overview.toSort.title', defaultMessage: '{count} to sort' },
        { count },
      );
    },
    toSortHint() {
      return intl.formatMessage({
        id: 'overview.toSort.hint',
        defaultMessage: 'Waiting for a category, not in totals yet',
      });
    },
    toSortAction(count) {
      return intl.formatMessage(
        {
          id: 'overview.toSort.action',
          defaultMessage:
            '{count, plural, one {# transaction} other {# transactions}} to sort, not in totals yet. Open To sort.',
        },
        { count: Math.min(count, TO_SORT_MAX) },
      );
    },
    categoriesTitle() {
      return intl.formatMessage({ id: 'overview.categories.title', defaultMessage: 'Categories' });
    },
    categoriesLegend() {
      return intl.formatMessage({
        id: 'overview.categories.legend',
        defaultMessage: 'Light = money left',
      });
    },
    categoriesEmpty() {
      return intl.formatMessage({
        id: 'overview.categories.empty',
        defaultMessage: 'No planned expenses in this plan yet.',
      });
    },
    showAll(count) {
      return intl.formatMessage(
        {
          id: 'overview.categories.showAll',
          defaultMessage: 'Show all {count, plural, one {# category} other {# categories}}',
        },
        { count },
      );
    },
    showFewer() {
      return intl.formatMessage({
        id: 'overview.categories.showFewer',
        defaultMessage: 'Show fewer',
      });
    },
    unplannedTitle() {
      return intl.formatMessage({ id: 'overview.unplanned.title', defaultMessage: 'Unplanned' });
    },
    unplannedHint() {
      return intl.formatMessage({
        id: 'overview.unplanned.hint',
        defaultMessage: 'Spending with no planned item, counted in the totals',
      });
    },
    noActivePlan() {
      return intl.formatMessage({
        id: 'overview.empty.title',
        defaultMessage: 'No active budget plan',
      });
    },
    noActivePlanHint() {
      return intl.formatMessage({
        id: 'overview.empty.hint',
        defaultMessage: 'Create a plan to see what is safe to spend each day.',
      });
    },
    createPlan() {
      return intl.formatMessage({ id: 'overview.empty.action', defaultMessage: 'Go to plans' });
    },
    error(error) {
      switch (error) {
        case 'plans_failed':
          return intl.formatMessage({
            id: 'overview.error.plans',
            defaultMessage: 'Could not load plans.',
          });
        case 'not_found':
          return intl.formatMessage({
            id: 'overview.error.notFound',
            defaultMessage: 'This plan was not found.',
          });
        case 'fx_unavailable':
          return intl.formatMessage({
            id: 'overview.error.fx',
            defaultMessage:
              'Exchange rates are not available right now, so the totals cannot be shown.',
          });
        case 'failed':
          return intl.formatMessage({
            id: 'overview.error.failed',
            defaultMessage: 'Could not load the overview.',
          });
      }
    },
  };
}
