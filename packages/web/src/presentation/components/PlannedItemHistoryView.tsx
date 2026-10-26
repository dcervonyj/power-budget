import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatMoney, parseMinorUnits } from '@power-budget/core';
import type { MoneyDto, PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import {
  changedFields,
  rollUpPlannedItemHistory,
  type PlannedItemFieldChange,
} from '../../application/plans/PlannedItemHistory.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';

export interface PlannedItemHistoryViewProps {
  readonly versions: readonly PlannedItemVersionDto[];
  readonly loading: boolean;
  readonly failed: boolean;
  /** The signed-in user (UserProfileDto.id); their own edits read "by you". */
  readonly currentUserId: string;
}

const LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const ENTRY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xxs)',
  padding: 'var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-tile)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
};

const DIM_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

function formatAmount(amount: MoneyDto | undefined, locale: string): string {
  if (amount === undefined) {
    return '—';
  }
  try {
    return formatMoney(
      { amountMinor: parseMinorUnits(amount.amountMinor), currency: amount.currency },
      toSupportedLocale(locale),
    );
  } catch {
    return `${amount.amountMinor} ${amount.currency}`;
  }
}

function formatNote(note: string | null | undefined): string {
  return note ? note : '—';
}

/** The version list of a planned item; props only, so the gallery renders every state. */
export function PlannedItemHistoryView({
  versions,
  loading,
  failed,
  currentUserId,
}: PlannedItemHistoryViewProps): React.JSX.Element {
  const intl = useIntl();
  const rolledUp = rollUpPlannedItemHistory(versions);

  const fieldLabel = (change: PlannedItemFieldChange): string => {
    switch (change.field) {
      case 'amount':
        return intl.formatMessage({
          id: 'component.historyDrawer.field.amount',
          defaultMessage: 'Amount',
        });
      case 'note':
        return intl.formatMessage({
          id: 'component.historyDrawer.field.note',
          defaultMessage: 'Note',
        });
    }
  };

  const fieldValues = (change: PlannedItemFieldChange): { before: string; after: string } => {
    switch (change.field) {
      case 'amount':
        return {
          before: formatAmount(change.before, intl.locale),
          after: formatAmount(change.after, intl.locale),
        };
      case 'note':
        return { before: formatNote(change.before), after: formatNote(change.after) };
    }
  };

  // Versions carry only the user id; the API has no member names yet.
  const actorLabel = (version: PlannedItemVersionDto): string =>
    version.changedBy === currentUserId
      ? intl.formatMessage({ id: 'component.historyDrawer.actorYou', defaultMessage: 'you' })
      : intl.formatMessage({
          id: 'component.historyDrawer.actorMember',
          defaultMessage: 'a household member',
        });

  if (loading) {
    return (
      <p style={DIM_STYLE}>
        <FormattedMessage id="component.historyDrawer.loading" defaultMessage="Loading…" />
      </p>
    );
  }
  if (failed) {
    return (
      <p role="alert" style={{ ...DIM_STYLE, color: 'var(--pb-glass-over)' }}>
        <FormattedMessage
          id="component.historyDrawer.error"
          defaultMessage="Failed to load the history"
        />
      </p>
    );
  }
  if (rolledUp.length === 0) {
    return (
      <p style={DIM_STYLE}>
        <FormattedMessage id="component.historyDrawer.empty" defaultMessage="No history yet" />
      </p>
    );
  }

  return (
    <ul style={LIST_STYLE}>
      {rolledUp.map((version) => (
        <li key={version.id} style={ENTRY_STYLE}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 'var(--pb-glass-space-xs)',
            }}
          >
            <span style={{ color: 'var(--pb-glass-fg)', fontWeight: 600 }}>
              <FormattedMessage
                id="component.historyDrawer.actor"
                defaultMessage="by {actor}"
                values={{ actor: actorLabel(version) }}
              />
            </span>
            <span style={DIM_STYLE}>
              {intl.formatDate(version.changedAt, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          {changedFields(version).map((change) => (
            <div key={change.field} style={DIM_STYLE}>
              <strong style={{ color: 'var(--pb-glass-fg)' }}>{fieldLabel(change)}</strong>
              {intl.formatMessage(
                { id: 'drawer.history.fieldChange', defaultMessage: ': {before} → {after}' },
                fieldValues(change),
              )}
            </div>
          ))}
          {version.reason !== null && (
            <div style={DIM_STYLE}>
              <FormattedMessage
                id="component.historyDrawer.reason"
                defaultMessage="Reason: {reason}"
                values={{ reason: version.reason }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
