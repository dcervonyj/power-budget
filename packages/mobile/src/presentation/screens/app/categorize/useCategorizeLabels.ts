import { useIntl } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { parseLocalIsoDate } from '@power-budget/core';
import { formatLightAmount } from '../../../glass/light/formatLightAmount.js';
import type { Impact } from './categorizeModel.js';

export interface CategorizeLabels {
  listTitle(): string;
  listLoading(): string;
  listError(): string;
  reloadError(): string;
  listEmpty(): string;
  sortAll(count: number): string;
  rowHint(): string;
  sheetTitle(position: number, total: number): string;
  allSortedTitle(): string;
  allSortedSummary(count: number): string;
  backToTransactions(): string;
  done(): string;
  date(day: string): string;
  suggested(): string;
  optionLeft(left: MinorUnitAmount): string;
  optionOver(over: MinorUnitAmount): string;
  optionPreview(impact: Impact): string;
  optionIncome(): string;
  optionAria(name: string, detail: string, suggested: boolean): string;
  optionsGroup(): string;
  previewText(name: string, impact: Impact): string;
  confirm(name: string): string;
  confirmDisabledHint(): string;
  confirmedTitle(name: string): string;
  confirmedLine(name: string, impact: Impact): string;
  next(title: string): string;
  finish(): string;
  undo(): string;
  choicesLoading(): string;
  choicesError(): string;
  choicesEmpty(): string;
  confirmError(): string;
  undoError(): string;
}

/** i18n strings of the To sort list and the Categorize sheet (categorize.* messages). */
export function useCategorizeLabels(): CategorizeLabels {
  const intl = useIntl();
  const text = (id: string, defaultMessage: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id, defaultMessage }, values);
  const amount = (money: MinorUnitAmount): string => formatLightAmount(money, intl.locale);
  const abs = (money: MinorUnitAmount): MinorUnitAmount => ({
    amountMinor: money.amountMinor < 0n ? -money.amountMinor : money.amountMinor,
    currency: money.currency,
  });

  return {
    listTitle: () => text('categorize.list.title', 'To sort'),
    listLoading: () => text('categorize.list.loading', 'Loading payments to sort'),
    listError: () => text('categorize.list.error', 'Could not load the payments to sort.'),
    reloadError: () =>
      text(
        'categorize.list.reloadError',
        'Could not refresh the payments. What you see may be out of date.',
      ),
    listEmpty: () => text('categorize.list.empty', 'All sorted'),
    sortAll: (count) => text('categorize.list.sortAll', 'Sort all {count}', { count }),
    rowHint: () => text('categorize.list.rowHint', 'Opens the category picker'),
    sheetTitle: (position, total) =>
      text('categorize.sheet.title', 'To sort · {position} of {total}', { position, total }),
    allSortedTitle: () => text('categorize.allSorted.title', 'All sorted'),
    allSortedSummary: (count) =>
      text(
        'categorize.allSorted.summary',
        '{count, plural, one {# payment sorted.} other {# payments sorted.}}',
        { count },
      ),
    backToTransactions: () => text('categorize.backToTransactions', 'Back to transactions'),
    done: () => text('categorize.done', 'Done'),
    date: (day) =>
      intl.formatDate(parseLocalIsoDate(day), { day: 'numeric', month: 'long', year: 'numeric' }),
    suggested: () => text('categorize.suggested', 'Suggested'),
    optionLeft: (left) => text('categorize.option.left', '{amount} left', { amount: amount(left) }),
    optionOver: (over) =>
      text('categorize.option.over', 'Over by {amount}', { amount: amount(abs(over)) }),
    optionPreview(impact) {
      const before = amount(abs(impact.before));
      const after = amount(abs(impact.after));
      if (impact.phase === 'alreadyOver') {
        return text('categorize.option.previewOver', 'Over by {before} → {after}', {
          before,
          after,
        });
      }
      if (impact.phase === 'crossing') {
        return text('categorize.option.previewCrossing', '{before} left → over by {after}', {
          before,
          after,
        });
      }

      return text('categorize.option.previewLeft', '{before} → {after} left', { before, after });
    },
    optionIncome: () => text('categorize.option.income', 'Income'),
    optionAria: (name, detail, suggested) =>
      [name, detail, suggested ? text('categorize.suggested', 'Suggested') : '']
        .filter((part) => part !== '')
        .join(', '),
    optionsGroup: () => text('categorize.options.group', 'Category'),
    previewText(name, impact) {
      if (impact.kind === 'income') {
        return text('categorize.preview.income', 'Counts as income in {name}.', { name });
      }
      if (impact.kind === 'foreign') {
        return text(
          'categorize.preview.foreign',
          'This payment is not in {currency}, so its effect on {name} is not shown.',
          { name, currency: impact.planned.currency },
        );
      }
      if (impact.kind === 'noPlan') {
        return text('categorize.preview.noPlan', '{name} has no planned amount.', { name });
      }
      const before = amount(abs(impact.before));
      const after = amount(abs(impact.after));
      if (impact.phase === 'alreadyOver') {
        return text(
          'categorize.preview.alreadyOver',
          '{name} is already over by {before}; this takes it to {after} over.',
          { name, before, after },
        );
      }
      if (impact.phase === 'crossing') {
        return text(
          'categorize.preview.crossing',
          'This drains {name} from {before} left to {after} over.',
          { name, before, after },
        );
      }

      return text('categorize.preview.under', 'This drains {name} from {before} to {after} left.', {
        name,
        before,
        after,
      });
    },
    confirm: (name) => text('categorize.confirm', 'Confirm · {name}', { name }),
    confirmDisabledHint: () => text('categorize.confirmHint', 'Choose a category first'),
    confirmedTitle: (name) => text('categorize.confirmed.title', 'Sorted into {name}', { name }),
    confirmedLine(name, impact) {
      if (impact.kind !== 'drain') {
        return text('categorize.confirmed.plain', 'Sorted into {name}.', { name });
      }
      const planned = amount(impact.planned);
      if (impact.after.amountMinor < 0n) {
        return text('categorize.confirmed.over', '{name} is {over} over its {planned} plan.', {
          name,
          over: amount(abs(impact.after)),
          planned,
        });
      }

      return text('categorize.confirmed.left', '{name}: {left} left of {planned}.', {
        name,
        left: amount(impact.after),
        planned,
      });
    },
    next: (title) => text('categorize.next', 'Next: {title}', { title }),
    finish: () => text('categorize.finish', 'Finish'),
    undo: () => text('categorize.undo', 'Undo'),
    choicesLoading: () => text('categorize.choices.loading', 'Loading categories'),
    choicesError: () => text('categorize.choices.error', 'Could not load the categories.'),
    choicesEmpty: () =>
      text('categorize.choices.empty', 'No category in the current plan fits this payment.'),
    confirmError: () => text('categorize.error.confirm', 'Could not sort the payment. Try again.'),
    undoError: () => text('categorize.error.undo', 'Could not undo. The payment is still sorted.'),
  };
}
