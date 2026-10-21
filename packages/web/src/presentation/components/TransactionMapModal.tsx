import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatMoney, parseMinorUnits } from '@power-budget/core';
import { readApiError } from '@power-budget/shared-app';
import type { SetMappingDto } from '@power-budget/shared-app/contract';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';
import { MoneyView } from './MoneyView.js';
import { apiClient, plansApi } from '../../AppProviders.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';
import { fetchCategoryNames } from '../../infrastructure/api/CategoryNames.js';
import {
  loadPlannedItems,
  suggestedFirst,
  type PlannedItemOption,
} from '../../application/transactions/PlannedItemLabels.js';
import type { Transaction } from '../../domain/transactions/Transaction.js';

export interface TransactionMapModalProps {
  readonly transaction: Transaction;
  /** The planned item the transaction is mapped to now, or null. */
  readonly currentPlannedItemId: string | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Called after the API accepted the change (null = mapping cleared). */
  readonly onMapped: (plannedItemId: string | null) => void;
  /** The transaction is gone or not the caller's (404); the modal closes. */
  readonly onGone?: () => void;
}

/**
 * Picks the planned item for ONE transaction. Notes, transfer and ignore live in the
 * detail modal; this one only maps.
 */
export function TransactionMapModal({
  transaction,
  currentPlannedItemId,
  isOpen,
  onClose,
  onMapped,
  onGone,
}: TransactionMapModalProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();

  const [options, setOptions] = useState<ReadonlyArray<PlannedItemOption>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    setError(null);
    setLoadError(false);
    setSelectedId(currentPlannedItemId);
    setLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const catalogue = await loadPlannedItems(plansApi, () => fetchCategoryNames(apiClient));
        if (!cancelled) {
          setOptions(suggestedFirst(catalogue.options, transaction.suggestedPlannedItemId));
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentPlannedItemId, transaction.suggestedPlannedItemId]);

  const submit = async (plannedItemId: string | null): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const body: SetMappingDto = { plannedItemId };
      await apiClient.patch(`/transactions/${transaction.id}/mapping`, body);
      onMapped(plannedItemId);
      onClose();
    } catch (err) {
      if (readApiError(err).status === 404 && onGone) {
        onGone();
        onClose();

        return;
      }
      setError(
        intl.formatMessage({
          id: 'screen.transactionDetail.mappingError',
          defaultMessage: 'Failed to update mapping',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const needle = query.trim().toLowerCase();
  const visible = options.filter((o) => matches(o, needle));
  const unchanged = selectedId === currentPlannedItemId;

  const footerButtons = [
    {
      label: intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' }),
      variant: 'secondary' as const,
      onClick: onClose,
    },
    ...(currentPlannedItemId === null
      ? []
      : [
          {
            label: intl.formatMessage({
              id: 'screen.transactionDetail.unmap',
              defaultMessage: 'Clear mapping',
            }),
            variant: 'danger' as const,
            onClick: () => {
              void submit(null);
            },
          },
        ]),
    {
      label: intl.formatMessage({
        id: 'screen.transactionMap.confirm',
        defaultMessage: 'Map transaction',
      }),
      variant: 'primary' as const,
      onClick: () => {
        if (selectedId !== null && !unchanged && !submitting) {
          void submit(selectedId);
        }
      },
    },
  ];

  return (
    <Modal
      title={intl.formatMessage({
        id: 'screen.transactionMap.title',
        defaultMessage: 'Map transaction',
      })}
      isOpen={isOpen}
      onClose={onClose}
      footerButtons={footerButtons}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: theme.space.md,
            color: theme.color.text.secondary,
            fontSize: theme.fontSize.sm,
          }}
        >
          <span style={{ overflowWrap: 'anywhere' }}>
            {transaction.merchant ?? transaction.description}
          </span>
          <MoneyView amount={transaction.amount} showTooltip={false} />
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          aria-label={intl.formatMessage({
            id: 'screen.transactionMap.search',
            defaultMessage: 'Search planned items',
          })}
          placeholder={intl.formatMessage({
            id: 'screen.transactionMap.search',
            defaultMessage: 'Search planned items',
          })}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: theme.color.surface.raised,
            color: theme.color.text.primary,
            border: `1px solid ${theme.color.border.subtle}`,
            borderRadius: theme.radius.sm,
            padding: `${theme.space.sm}px ${theme.space.md}px`,
            fontSize: theme.fontSize.md,
          }}
        />

        {error !== null && (
          <p role="alert" style={{ color: theme.color.status.danger, margin: 0 }}>
            {error}
          </p>
        )}
        {loadError && (
          <p role="alert" style={{ color: theme.color.status.danger, margin: 0 }}>
            <FormattedMessage
              id="screen.transactionMap.loadError"
              defaultMessage="Failed to load planned items"
            />
          </p>
        )}
        {loading && (
          <p style={{ color: theme.color.text.secondary, margin: 0 }}>
            <FormattedMessage id="app.loading" defaultMessage="Loading…" />
          </p>
        )}
        {!loading && !loadError && visible.length === 0 && (
          <p style={{ color: theme.color.text.secondary, margin: 0, fontSize: theme.fontSize.sm }}>
            <FormattedMessage
              id="screen.transactionDetail.noPlannedItems"
              defaultMessage="No planned items available"
            />
          </p>
        )}

        <div
          role="radiogroup"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.space.xs,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {visible.map((option) => (
            <OptionRow
              key={option.item.id}
              option={option}
              selected={selectedId === option.item.id}
              current={currentPlannedItemId === option.item.id}
              suggested={transaction.suggestedPlannedItemId === option.item.id}
              disabled={submitting}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function matches(option: PlannedItemOption, needle: string): boolean {
  if (needle === '') {
    return true;
  }

  return `${option.categoryName} ${option.planName}`.toLowerCase().includes(needle);
}

interface OptionRowProps {
  readonly option: PlannedItemOption;
  readonly selected: boolean;
  readonly current: boolean;
  readonly suggested: boolean;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}

function OptionRow({
  option,
  selected,
  current,
  suggested,
  disabled,
  onSelect,
}: OptionRowProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const { item } = option;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => {
        onSelect(item.id);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
        textAlign: 'left',
        padding: `${theme.space.sm}px ${theme.space.md}px`,
        borderRadius: theme.radius.md,
        cursor: 'pointer',
        color: theme.color.text.primary,
        backgroundColor: selected ? `${theme.color.accent.default}22` : 'transparent',
        border: `1px solid ${selected ? theme.color.accent.default : theme.color.border.subtle}`,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: theme.fontSize.md }}>
          {option.categoryName || item.categoryId}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: theme.fontSize.xs,
            color: theme.color.text.secondary,
          }}
        >
          {intl.formatMessage(
            {
              id: 'modal.transactionDetail.planAndDirection',
              defaultMessage: '{planName} · {direction}',
            },
            { planName: option.planName, direction: item.direction },
          )}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm }}>
        {suggested && (
          <Chip color={theme.color.accent.default}>
            <FormattedMessage id="mapping.suggested" defaultMessage="Suggested" />
          </Chip>
        )}
        {current && (
          <Chip color={theme.color.text.secondary}>
            <FormattedMessage id="screen.transactionMap.current" defaultMessage="Current" />
          </Chip>
        )}
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
          {formatMoney(
            {
              amountMinor: parseMinorUnits(item.amount.amountMinor),
              currency: item.amount.currency,
            },
            toSupportedLocale(intl.locale),
          )}
        </span>
      </span>
    </button>
  );
}

function Chip({
  color,
  children,
}: {
  readonly color: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <span
      style={{
        fontSize: theme.fontSize.xs,
        color,
        border: `1px solid ${color}`,
        borderRadius: theme.radius.sm,
        padding: `2px ${theme.space.sm}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
