import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatMoney, parseMinorUnits } from '@power-budget/core';
import { readApiError } from '@power-budget/shared-app';
import type { PlanDashboardResponseDto, SetMappingDto } from '@power-budget/shared-app/contract';
import { Button } from './Button.js';
import { MoneyView } from './MoneyView.js';
import { apiClient, plansApi } from '../../AppProviders.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';
import { formatAmount } from '../i18n/formatAmount.js';
import { fetchCategoryNames } from '../../infrastructure/api/CategoryNames.js';
import {
  loadPlannedItems,
  suggestedFirst,
  type PlannedItemOption,
} from '../../application/transactions/PlannedItemLabels.js';
import {
  previewCategoryRod,
  type CategoryRodPreview,
} from '../../application/transactions/MappingViewPreview.js';
import type { Transaction } from '../../domain/transactions/Transaction.js';
import { Sheet } from '../glass/overlays/Sheet.js';
import { Rod } from '../glass/light/Rod.js';
import { useLightLabels } from '../glass/light/useLightLabels.js';
import {
  ALERT_TEXT,
  DIALOG_COLUMN,
  FIELD_CONTROL,
  MUTED_TEXT,
  optionStyle,
} from './transactionDialogStyles.js';

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
  const intl = useIntl();

  const [options, setOptions] = useState<ReadonlyArray<PlannedItemOption>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CategoryRodPreview | null>(null);
  const dashboards = useRef(new Map<string, Promise<PlanDashboardResponseDto>>());

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

  // Live rod of the picked item as it would be once this transaction counts in it.
  useEffect(() => {
    const picked = options.find((o) => o.item.id === selectedId);
    if (!isOpen || picked === undefined) {
      setPreview(null);

      return;
    }
    let cancelled = false;
    const planId = picked.item.planId;
    const cached = dashboards.current.get(planId) ?? plansApi.dashboard(planId);
    dashboards.current.set(planId, cached);
    void cached
      .then((dashboard) => rodAfterMapping(dashboard, picked, transaction, currentPlannedItemId))
      .catch(() => null)
      .then((rod) => {
        if (!cancelled) {
          setPreview(rod);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, options, selectedId, transaction, currentPlannedItemId]);

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

  const picked = options.find((o) => o.item.id === selectedId);

  return (
    <TransactionMapView
      transaction={transaction}
      isOpen={isOpen}
      options={options}
      query={query}
      selectedId={selectedId}
      currentPlannedItemId={currentPlannedItemId}
      loading={loading}
      loadError={loadError}
      error={error}
      submitting={submitting}
      preview={preview}
      previewName={picked?.categoryName || picked?.item.categoryId || ''}
      onQuery={setQuery}
      onSelect={setSelectedId}
      onConfirm={() => {
        if (selectedId !== null && selectedId !== currentPlannedItemId && !submitting) {
          void submit(selectedId);
        }
      }}
      onClear={() => {
        void submit(null);
      }}
      onClose={onClose}
    />
  );
}

function rodAfterMapping(
  dashboard: PlanDashboardResponseDto,
  picked: PlannedItemOption,
  transaction: Transaction,
  currentPlannedItemId: string | null,
): CategoryRodPreview | null {
  const line = dashboard.expenseLines.find((l) => l.plannedItemId === picked.item.id);
  if (line === undefined) {
    return null;
  }
  const spent = parseMinorUnits(line.actual.amountMinor);
  // Already counted in this item when the transaction is mapped to it now.
  const alreadyCounted =
    currentPlannedItemId === picked.item.id ? -transaction.amount.amountMinor : 0n;

  return previewCategoryRod(
    { amountMinor: parseMinorUnits(line.planned.amountMinor), currency: line.planned.currency },
    { amountMinor: spent - alreadyCounted, currency: line.actual.currency },
    transaction.amount,
  );
}

export interface TransactionMapViewProps {
  readonly transaction: Transaction;
  readonly isOpen: boolean;
  /** Suggested item first. */
  readonly options: ReadonlyArray<PlannedItemOption>;
  readonly query: string;
  readonly selectedId: string | null;
  readonly currentPlannedItemId: string | null;
  readonly loading: boolean;
  readonly loadError: boolean;
  readonly error: string | null;
  readonly submitting: boolean;
  readonly preview: CategoryRodPreview | null;
  readonly previewName: string;
  readonly onQuery: (query: string) => void;
  readonly onSelect: (plannedItemId: string) => void;
  readonly onConfirm: () => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

/** The map sheet from props only: payment, search, options (suggestion first), live rod. */
export function TransactionMapView({
  transaction,
  isOpen,
  options,
  query,
  selectedId,
  currentPlannedItemId,
  loading,
  loadError,
  error,
  submitting,
  preview,
  previewName,
  onQuery,
  onSelect,
  onConfirm,
  onClear,
  onClose,
}: TransactionMapViewProps): React.JSX.Element | null {
  const intl = useIntl();
  const needle = query.trim().toLowerCase();
  const visible = options.filter((o) => matches(o, needle));
  const searchLabel = intl.formatMessage({
    id: 'screen.transactionMap.search',
    defaultMessage: 'Search planned items',
  });

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
      </Button>
      {currentPlannedItemId === null ? null : (
        <Button variant="danger" onClick={onClear}>
          {intl.formatMessage({
            id: 'screen.transactionDetail.unmap',
            defaultMessage: 'Clear mapping',
          })}
        </Button>
      )}
      <Button variant="primary" onClick={onConfirm}>
        {intl.formatMessage({
          id: 'screen.transactionMap.confirm',
          defaultMessage: 'Map transaction',
        })}
      </Button>
    </>
  );

  return (
    <Sheet
      title={intl.formatMessage({
        id: 'screen.transactionMap.title',
        defaultMessage: 'Map transaction',
      })}
      isOpen={isOpen}
      onClose={onClose}
      footer={footer}
    >
      <div style={DIALOG_COLUMN}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--pb-glass-space-md)',
            color: 'var(--pb-glass-dim)',
            fontSize: 'var(--pb-glass-type-small-web)',
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
            onQuery(e.target.value);
          }}
          aria-label={searchLabel}
          placeholder={searchLabel}
          className="pbg-ctl pbg-ctl-field"
          style={FIELD_CONTROL}
        />

        {error !== null && (
          <p role="alert" style={ALERT_TEXT}>
            {error}
          </p>
        )}
        {loadError && (
          <p role="alert" style={ALERT_TEXT}>
            <FormattedMessage
              id="screen.transactionMap.loadError"
              defaultMessage="Failed to load planned items"
            />
          </p>
        )}
        {loading && (
          <p style={MUTED_TEXT}>
            <FormattedMessage id="app.loading" defaultMessage="Loading…" />
          </p>
        )}
        {!loading && !loadError && visible.length === 0 && (
          <p style={MUTED_TEXT}>
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
            gap: 'var(--pb-glass-space-xs)',
            maxHeight: 320,
            overflowY: 'auto',
            padding: 2,
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
              onSelect={onSelect}
            />
          ))}
        </div>

        {preview === null ? null : <RodPreview preview={preview} name={previewName} />}
      </div>
    </Sheet>
  );
}

function matches(option: PlannedItemOption, needle: string): boolean {
  if (needle === '') {
    return true;
  }

  return `${option.categoryName} ${option.planName}`.toLowerCase().includes(needle);
}

function RodPreview({
  preview,
  name,
}: {
  readonly preview: CategoryRodPreview;
  readonly name: string;
}): React.JSX.Element {
  const intl = useIntl();
  const labels = useLightLabels();
  const over = preview.state === 'over';
  const caption = over
    ? intl.formatMessage(
        {
          id: 'transaction-dialogs.map.previewOver',
          defaultMessage: 'After mapping: over by {amount}',
        },
        { amount: formatAmount(preview.remaining, intl.locale) },
      )
    : intl.formatMessage(
        {
          id: 'transaction-dialogs.map.previewLeft',
          defaultMessage: 'After mapping: {amount} left of {plan}',
        },
        {
          amount: formatAmount(preview.remaining, intl.locale),
          plan: formatAmount(preview.planned, intl.locale),
        },
      );

  return (
    <div
      data-testid="map-rod-preview"
      style={{ ...DIALOG_COLUMN, gap: 'var(--pb-glass-space-xs)' }}
    >
      <span style={{ fontSize: 'var(--pb-glass-type-label-web)', fontWeight: 600 }}>{name}</span>
      <Rod
        rod={{
          fraction: preview.fraction,
          state: preview.state,
          size: 'category',
          ariaLabel: labels.rodAria(name, preview.state, preview.remaining, preview.planned),
        }}
        tagLabel={over ? labels.rodTag('over') : undefined}
      />
      <span style={MUTED_TEXT}>{caption}</span>
    </div>
  );
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
  const intl = useIntl();
  const { item } = option;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className="pbg-ctl"
      onClick={() => {
        onSelect(item.id);
      }}
      style={optionStyle(selected)}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block' }}>{option.categoryName || item.categoryId}</span>
        <span style={{ display: 'block', ...MUTED_TEXT }}>
          {intl.formatMessage(
            {
              id: 'modal.transactionDetail.planAndDirection',
              defaultMessage: '{planName} · {direction}',
            },
            { planName: option.planName, direction: item.direction },
          )}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-sm)' }}>
        {suggested && (
          <Chip>
            <FormattedMessage id="mapping.suggested" defaultMessage="Suggested" />
          </Chip>
        )}
        {current && (
          <Chip>
            <FormattedMessage id="screen.transactionMap.current" defaultMessage="Current" />
          </Chip>
        )}
        <span style={{ ...MUTED_TEXT, whiteSpace: 'nowrap' }}>
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

function Chip({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        fontSize: 'var(--pb-glass-type-tag-web)',
        fontWeight: 'var(--pb-glass-type-tag-weight)',
        color: 'var(--pb-glass-fg)',
        background: 'var(--pb-glass-fill2)',
        borderRadius: 'var(--pb-glass-radius-tag)',
        padding: '2px var(--pb-glass-space-sm)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
