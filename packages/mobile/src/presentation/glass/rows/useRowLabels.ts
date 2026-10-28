import { NO_LABEL } from '../../../domain/display.js';
import { useIntl } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { formatLightAmount } from '../light/formatLightAmount.js';

export type TxProvenance = 'bank' | 'manual' | 'rule';
export type TxRowKind = 'live' | 'pending' | 'booked' | 'transfer' | 'to-sort';

export interface TxNameInput {
  readonly kind: TxRowKind;
  readonly title: string;
  readonly amount: MinorUnitAmount;
  readonly subtitle: string;
  readonly suggestion?: string;
}

export interface RowLabels {
  txName(input: TxNameInput): string;
  statusPending(): string;
  statusLive(): string;
  statusTransfer(): string;
  statusToSort(): string;
  provenance(source: TxProvenance): string;
  suggestionText(category: string, confidencePercent: number | undefined): string;
  suggestionApplied(category: string): string;
  confirmAction(title: string): string;
  undoAction(title: string): string;
  chooseAction(title: string): string;
  confirmText(): string;
  undoText(): string;
  chooseText(): string;
  categoryName(name: string, spent: MinorUnitAmount, totalOnly: boolean): string;
  left(amount: MinorUnitAmount): string;
  planned(amount: MinorUnitAmount): string;
  forecast(amount: MinorUnitAmount): string;
  underPlan(): string;
  overBy(amount: MinorUnitAmount): string;
  paid(): string;
  totalsOnly(): string;
  totalSpent(): string;
}

/** i18n strings for TxRow and CategoryRow (glass-rows.* messages); amounts go through formatLightAmount. */
export function useRowLabels(): RowLabels {
  const intl = useIntl();

  return {
    txName({ kind, title, amount, subtitle, suggestion }) {
      const values = {
        title,
        amount: formatLightAmount(amount, intl.locale),
        subtitle,
        suggestion: suggestion ?? NO_LABEL,
      };
      if (kind === 'live') {
        return intl.formatMessage(
          {
            id: 'glass-rows.tx.aria.live',
            defaultMessage: '{title}, {amount}, just synced, {subtitle}',
          },
          values,
        );
      }
      if (kind === 'pending') {
        return intl.formatMessage(
          {
            id: 'glass-rows.tx.aria.pending',
            defaultMessage: '{title}, {amount}, pending, {subtitle}',
          },
          values,
        );
      }
      if (kind === 'transfer') {
        return intl.formatMessage(
          {
            id: 'glass-rows.tx.aria.transfer',
            defaultMessage: '{title}, transfer, {amount}, {subtitle}',
          },
          values,
        );
      }
      if (kind === 'to-sort') {
        return suggestion === undefined
          ? intl.formatMessage(
              {
                id: 'glass-rows.tx.aria.toSortNoSuggestion',
                defaultMessage: '{title}, {amount}, to sort, no suggestion, {subtitle}',
              },
              values,
            )
          : intl.formatMessage(
              {
                id: 'glass-rows.tx.aria.toSort',
                defaultMessage: '{title}, {amount}, to sort, suggested {suggestion}, {subtitle}',
              },
              values,
            );
      }

      return intl.formatMessage(
        { id: 'glass-rows.tx.aria.booked', defaultMessage: '{title}, {amount}, {subtitle}' },
        values,
      );
    },
    statusPending() {
      return intl.formatMessage({ id: 'glass-rows.tx.status.pending', defaultMessage: 'Pending' });
    },
    statusLive() {
      return intl.formatMessage({ id: 'glass-rows.tx.status.live', defaultMessage: 'Just in' });
    },
    statusTransfer() {
      return intl.formatMessage({
        id: 'glass-rows.tx.status.transfer',
        defaultMessage: 'Transfer',
      });
    },
    statusToSort() {
      return intl.formatMessage({ id: 'glass-rows.tx.status.toSort', defaultMessage: 'To sort' });
    },
    provenance(source) {
      if (source === 'manual') {
        return intl.formatMessage({
          id: 'glass-rows.tx.provenance.manual',
          defaultMessage: 'Added by hand',
        });
      }
      if (source === 'rule') {
        return intl.formatMessage({
          id: 'glass-rows.tx.provenance.rule',
          defaultMessage: 'By rule',
        });
      }

      return intl.formatMessage({
        id: 'glass-rows.tx.provenance.bank',
        defaultMessage: 'From bank',
      });
    },
    suggestionText(category, confidencePercent) {
      if (confidencePercent === undefined) {
        return intl.formatMessage(
          { id: 'glass-rows.tx.suggestion', defaultMessage: 'Suggested: {category}' },
          { category },
        );
      }

      return intl.formatMessage(
        {
          id: 'glass-rows.tx.suggestionConfidence',
          defaultMessage: 'Suggested: {category} {percent}%',
        },
        { category, percent: confidencePercent },
      );
    },
    suggestionApplied(category) {
      return intl.formatMessage(
        { id: 'glass-rows.tx.suggestionApplied', defaultMessage: 'Sorted into {category}' },
        { category },
      );
    },
    confirmAction(title) {
      return intl.formatMessage(
        {
          id: 'glass-rows.tx.confirm.aria',
          defaultMessage: 'Confirm the suggested category for {title}',
        },
        { title },
      );
    },
    undoAction(title) {
      return intl.formatMessage(
        { id: 'glass-rows.tx.undo.aria', defaultMessage: 'Undo the category for {title}' },
        { title },
      );
    },
    chooseAction(title) {
      return intl.formatMessage(
        { id: 'glass-rows.tx.choose.aria', defaultMessage: 'Choose a category for {title}' },
        { title },
      );
    },
    confirmText() {
      return intl.formatMessage({ id: 'glass-rows.tx.confirm', defaultMessage: 'Confirm' });
    },
    undoText() {
      return intl.formatMessage({ id: 'glass-rows.tx.undo', defaultMessage: 'Undo' });
    },
    chooseText() {
      return intl.formatMessage({ id: 'glass-rows.tx.choose', defaultMessage: 'Choose' });
    },
    categoryName(name, spent, totalOnly) {
      const values = { name, spent: formatLightAmount(spent, intl.locale) };
      if (totalOnly) {
        return intl.formatMessage(
          {
            id: 'glass-rows.category.aria.totalOnly',
            defaultMessage: '{name}: {spent} spent, totals only',
          },
          values,
        );
      }

      return intl.formatMessage(
        { id: 'glass-rows.category.aria', defaultMessage: '{name}: {spent} spent' },
        values,
      );
    },
    left(amount) {
      return intl.formatMessage(
        { id: 'glass-rows.category.left', defaultMessage: '{amount} left' },
        { amount: formatLightAmount(amount, intl.locale) },
      );
    },
    planned(amount) {
      return intl.formatMessage(
        { id: 'glass-rows.category.planned', defaultMessage: 'of {amount}' },
        { amount: formatLightAmount(amount, intl.locale) },
      );
    },
    forecast(amount) {
      return intl.formatMessage(
        { id: 'glass-rows.category.forecast', defaultMessage: '≈ {amount} at this pace' },
        { amount: formatLightAmount(amount, intl.locale) },
      );
    },
    underPlan() {
      return intl.formatMessage({
        id: 'glass-rows.category.underPlan',
        defaultMessage: 'Under plan',
      });
    },
    overBy(amount) {
      return intl.formatMessage(
        { id: 'glass-rows.category.overBy', defaultMessage: 'Over by {amount}' },
        { amount: formatLightAmount(amount, intl.locale) },
      );
    },
    paid() {
      return intl.formatMessage({ id: 'glass-rows.category.paid', defaultMessage: 'Paid' });
    },
    totalsOnly() {
      return intl.formatMessage({
        id: 'glass-rows.category.totalsOnly',
        defaultMessage: 'Totals only',
      });
    },
    totalSpent() {
      return intl.formatMessage({
        id: 'glass-rows.category.totalSpent',
        defaultMessage: 'Spent in total',
      });
    },
  };
}
