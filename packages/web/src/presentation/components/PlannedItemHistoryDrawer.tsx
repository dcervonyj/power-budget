import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatMoney, parseMinorUnits } from '@power-budget/core';
import type { MoneyDto, PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../AppProviders.js';
import {
  changedFields,
  rollUpPlannedItemHistory,
  type PlannedItemFieldChange,
} from '../../application/plans/PlannedItemHistory.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';
import { Drawer } from './Drawer.js';
import { useTheme } from './ThemeContext.js';

export interface PlannedItemHistoryDrawerProps {
  planId: string;
  itemId: string;
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in user (UserProfileDto.id); their own edits read "by you". */
  currentUserId: string;
}

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

export function PlannedItemHistoryDrawer({
  planId,
  itemId,
  isOpen,
  onClose,
  currentUserId,
}: PlannedItemHistoryDrawerProps): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [versions, setVersions] = useState<PlannedItemVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) return;
    setLoading(true);
    setFailed(false);
    const fetchHistory = async (): Promise<void> => {
      try {
        setVersions(await plansApi.itemHistory(planId, itemId));
      } catch {
        setVersions([]);
        setFailed(true);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };
    void fetchHistory();
  }, [isOpen, loaded, planId, itemId]);

  // Reset when item changes
  useEffect(() => {
    setLoaded(false);
    setVersions([]);
  }, [planId, itemId]);

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

  const title = intl.formatMessage({
    id: 'component.historyDrawer.title',
    defaultMessage: 'History',
  });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} width={480}>
      {loading ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.historyDrawer.loading" defaultMessage="Loading…" />
        </p>
      ) : failed ? (
        <p style={{ color: theme.color.status.danger }}>
          <FormattedMessage
            id="component.historyDrawer.error"
            defaultMessage="Failed to load the history"
          />
        </p>
      ) : rolledUp.length === 0 ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.historyDrawer.empty" defaultMessage="No history yet" />
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rolledUp.map((version) => (
            <li
              key={version.id}
              style={{
                borderBottom: `1px solid ${theme.color.border.subtle}`,
                paddingBottom: theme.space.md,
                marginBottom: theme.space.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: theme.space.xs,
                }}
              >
                <span style={{ color: theme.color.text.primary, fontWeight: 600 }}>
                  <FormattedMessage
                    id="component.historyDrawer.actor"
                    defaultMessage="by {actor}"
                    values={{ actor: actorLabel(version) }}
                  />
                </span>
                <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
                  {intl.formatDate(version.changedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div>
                {changedFields(version).map((change) => (
                  <div
                    key={change.field}
                    style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}
                  >
                    <strong style={{ color: theme.color.text.primary }}>
                      {fieldLabel(change)}
                    </strong>
                    {intl.formatMessage(
                      { id: 'drawer.history.fieldChange', defaultMessage: ': {before} → {after}' },
                      fieldValues(change),
                    )}
                  </div>
                ))}
                {version.reason !== null && (
                  <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
                    <FormattedMessage
                      id="component.historyDrawer.reason"
                      defaultMessage="Reason: {reason}"
                      values={{ reason: version.reason }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
