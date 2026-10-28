import { apiClient, referenceCatalogue } from '../../composition.js';
import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { Button } from './Button.js';
import { Sheet } from '../glass/overlays/Sheet.js';
import { StatusTag } from '../glass/atoms/StatusTag.js';
import {
  ALERT_TEXT,
  DIALOG_SECTION,
  FIELD_LABEL,
  MUTED_TEXT,
  SPLIT_LINE,
  TEXT_AREA_CONTROL,
} from './transactionDialogStyles.js';
import { MoneyView } from './MoneyView.js';
import { parseLocalIsoDate } from '@power-budget/core';
import { TransactionMapModal } from './TransactionMapModal.js';
import { readApiError } from '@power-budget/shared-app';
import type { PatchTransactionDto, TransactionDetailDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';
import type { Transaction, TransactionMapping } from '../../domain/transactions/Transaction.js';
import {
  loadPlannedItems,
  type PlannedItemCatalogue,
} from '../../application/transactions/PlannedItemLabels.js';

export type { Transaction, TransactionMapping } from '../../domain/transactions/Transaction.js';

export interface TransactionDetailModalProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (tx: Transaction) => void;
  /**
   * The transaction is gone or not the caller's (404 on read or write; a partner's
   * transactions are private). Without it the modal shows the load error.
   */
  onGone?: (id: string) => void;
}

export function TransactionDetailModal({
  transactionId,
  isOpen,
  onClose,
  onUpdated,
  onGone,
}: TransactionDetailModalProps): React.JSX.Element | null {
  const intl = useIntl();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [mapping, setMapping] = useState<TransactionMapping | null>(null);

  const [isTransfer, setIsTransfer] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [togglingTransfer, setTogglingTransfer] = useState(false);
  const [togglingIgnored, setTogglingIgnored] = useState(false);

  const [catalogue, setCatalogue] = useState<PlannedItemCatalogue | null>(null);
  // Read in the load effect without refetching when the parent passes a new callback.
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  const [showMapModal, setShowMapModal] = useState(false);

  // Reset state when opening a new transaction
  useEffect(() => {
    if (!isOpen) return;
    setTransaction(null);
    setFetchError(null);
    setNotes('');
    setMapping(null);
    setIsTransfer(false);
    setIgnored(false);
    setShowMapModal(false);
    setNotesError(null);
    setLoading(true);

    let cancelled = false;

    void (async () => {
      try {
        const res = await apiClient.get<TransactionDetailDto>(`/transactions/${transactionId}`);
        if (cancelled) return;
        const tx = TransactionMapper.fromDetail(res.data);
        setTransaction(tx);
        setNotes(tx.notes ?? '');
        setMapping(tx.mapping);
        setIsTransfer(tx.isTransfer);
        setIgnored(tx.ignored);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const gone = onGoneRef.current;
        if (readApiError(err).status === 404 && gone) {
          gone(transactionId);
        } else {
          setFetchError(
            intl.formatMessage({
              id: 'screen.transactionDetail.fetchError',
              defaultMessage: 'Failed to load transaction',
            }),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, transactionId, intl]);

  // A mapped transaction needs the plans and items to name its planned item.
  useEffect(() => {
    if (mapping === null || catalogue !== null) {
      return;
    }
    let cancelled = false;
    void loadPlannedItems(referenceCatalogue).then(
      (loaded) => {
        if (!cancelled) {
          setCatalogue(loaded);
        }
      },
      () => undefined,
    );

    return () => {
      cancelled = true;
    };
  }, [mapping, catalogue]);

  const handleMapped = (plannedItemId: string | null): void => {
    const newMapping: TransactionMapping | null =
      plannedItemId === null
        ? null
        : { plannedItemId, planName: '', planArchived: false, categoryName: '', by: 'manual' };
    setMapping(newMapping);
    if (transaction) {
      const updatedTx: Transaction = { ...transaction, mapping: newMapping };
      setTransaction(updatedTx);
      onUpdated?.(updatedTx);
    }
  };

  const handleSaveNotes = async (): Promise<void> => {
    setSavingNotes(true);
    setNotesError(null);
    try {
      const body: PatchTransactionDto = { notes };
      await apiClient.patch(`/transactions/${transactionId}`, body);
      const updatedTx: Transaction | null = transaction ? { ...transaction, notes } : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setNotesError(
        intl.formatMessage({
          id: 'screen.transactionDetail.saveError',
          defaultMessage: 'Failed to save',
        }),
      );
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleTransfer = async (): Promise<void> => {
    const prev = isTransfer;
    setIsTransfer(!prev);
    setTogglingTransfer(true);
    try {
      if (!prev) {
        await apiClient.post(`/transactions/${transactionId}/transfer`, {});
      } else {
        await apiClient.delete(`/transactions/${transactionId}/transfer`);
      }
      const updatedTx: Transaction | null = transaction
        ? { ...transaction, isTransfer: !prev }
        : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setIsTransfer(prev);
    } finally {
      setTogglingTransfer(false);
    }
  };

  const handleToggleIgnored = async (): Promise<void> => {
    const prev = ignored;
    setIgnored(!prev);
    setTogglingIgnored(true);
    try {
      const body: PatchTransactionDto = { ignored: !prev };
      await apiClient.patch(`/transactions/${transactionId}`, body);
      const updatedTx: Transaction | null = transaction ? { ...transaction, ignored: !prev } : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setIgnored(prev);
    } finally {
      setTogglingIgnored(false);
    }
  };

  const mappedLabel = mapping === null ? undefined : catalogue?.labels.get(mapping.plannedItemId);

  return (
    <TransactionDetailView
      isOpen={isOpen}
      onClose={onClose}
      loading={loading}
      fetchError={fetchError}
      transaction={transaction}
      notes={notes}
      onNotes={setNotes}
      savingNotes={savingNotes}
      notesError={notesError}
      onSaveNotes={() => {
        void handleSaveNotes();
      }}
      mappedTo={
        mapping === null
          ? null
          : {
              categoryName: mappedLabel?.categoryName || mapping.plannedItemId,
              planName: mappedLabel?.planName ?? '',
            }
      }
      isTransfer={isTransfer}
      ignored={ignored}
      togglingTransfer={togglingTransfer}
      togglingIgnored={togglingIgnored}
      onToggleTransfer={() => {
        void handleToggleTransfer();
      }}
      onToggleIgnored={() => {
        void handleToggleIgnored();
      }}
      onOpenMap={() => {
        setShowMapModal(true);
      }}
      mapDialog={
        transaction === null ? null : (
          <TransactionMapModal
            transaction={transaction}
            currentPlannedItemId={mapping?.plannedItemId ?? null}
            isOpen={showMapModal}
            onClose={() => {
              setShowMapModal(false);
            }}
            onMapped={handleMapped}
            onGone={
              onGone === undefined
                ? undefined
                : () => {
                    onGone(transactionId);
                  }
            }
          />
        )
      }
    />
  );
}

export interface TransactionDetailViewProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly loading: boolean;
  readonly fetchError: string | null;
  readonly transaction: Transaction | null;
  readonly notes: string;
  readonly onNotes: (notes: string) => void;
  readonly savingNotes: boolean;
  readonly notesError: string | null;
  readonly onSaveNotes: () => void;
  /** Null when the transaction is not mapped; empty plan name when the plan is not known yet. */
  readonly mappedTo: { readonly categoryName: string; readonly planName: string } | null;
  readonly isTransfer: boolean;
  readonly ignored: boolean;
  readonly togglingTransfer: boolean;
  readonly togglingIgnored: boolean;
  readonly onToggleTransfer: () => void;
  readonly onToggleIgnored: () => void;
  readonly onOpenMap: () => void;
  /** The map sheet, opened over this one. */
  readonly mapDialog: React.ReactNode;
}

/** The detail sheet from props only: amount, who and when, mapping, notes, transfer and ignore. */
export function TransactionDetailView({
  isOpen,
  onClose,
  loading,
  fetchError,
  transaction,
  notes,
  onNotes,
  savingNotes,
  notesError,
  onSaveNotes,
  mappedTo,
  isTransfer,
  ignored,
  togglingTransfer,
  togglingIgnored,
  onToggleTransfer,
  onToggleIgnored,
  onOpenMap,
  mapDialog,
}: TransactionDetailViewProps): React.JSX.Element {
  const intl = useIntl();

  const title = intl.formatMessage({
    id: 'screen.transactionDetail.title',
    defaultMessage: 'Transaction Details',
  });

  return (
    <Sheet title={title} isOpen={isOpen} onClose={onClose}>
      {loading && (
        <p style={MUTED_TEXT}>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </p>
      )}

      {fetchError !== null && (
        <p role="alert" style={ALERT_TEXT}>
          {fetchError}
        </p>
      )}

      {transaction !== null && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-md)' }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}
          >
            <div style={{ ...SPLIT_LINE, flexWrap: 'nowrap' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--pb-glass-type-amount-web)' }}>
                <MoneyView amount={transaction.amount} showTooltip />
              </span>
              <span style={MUTED_TEXT}>
                {parseLocalIsoDate(transaction.occurredOn).toLocaleDateString(intl.locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div>
              <p style={{ margin: 0, fontSize: 'var(--pb-glass-type-body-web)' }}>
                {transaction.description}
              </p>
              {transaction.merchant !== null &&
                transaction.merchant !== transaction.description && (
                  <p style={{ ...MUTED_TEXT, marginTop: 'var(--pb-glass-space-xs)' }}>
                    {transaction.merchant}
                  </p>
                )}
            </div>

            <p style={MUTED_TEXT}>
              {[sourceLabel(intl, transaction.source), statusLabel(intl, transaction.status)].join(
                ' · ',
              )}
            </p>
          </div>

          {/* Mapping section: read-only here; the Map sheet edits it */}
          <div style={DIALOG_SECTION}>
            <p style={{ ...FIELD_LABEL, margin: 0 }}>
              <FormattedMessage id="screen.transactionDetail.mapping" defaultMessage="Mapped to" />
            </p>

            <div style={SPLIT_LINE}>
              <span style={{ fontSize: 'var(--pb-glass-type-body-web)' }}>
                {isTransfer ? (
                  <StatusTag
                    kind="neutral"
                    icon="repeat"
                    label={intl.formatMessage({
                      id: 'component.transactionRow.transfer',
                      defaultMessage: 'Transfer',
                    })}
                  />
                ) : mappedTo === null ? (
                  <FormattedMessage
                    id="screen.transactionDetail.notMapped"
                    defaultMessage="Not mapped"
                  />
                ) : (
                  <>
                    <span style={{ fontWeight: 600 }}>{mappedTo.categoryName}</span>
                    {mappedTo.planName !== '' && (
                      <span
                        style={{ ...MUTED_TEXT, marginInlineStart: 'var(--pb-glass-space-sm)' }}
                      >
                        {mappedTo.planName}
                      </span>
                    )}
                  </>
                )}
              </span>
              <Button variant="secondary" onClick={onOpenMap}>
                {mappedTo === null ? (
                  <FormattedMessage
                    id="screen.transactionDetail.mapTo"
                    defaultMessage="Map to planned item"
                  />
                ) : (
                  <FormattedMessage
                    id="screen.transactionDetail.changeMapping"
                    defaultMessage="Change mapping"
                  />
                )}
              </Button>
            </div>
          </div>

          {/* Notes section */}
          <div style={DIALOG_SECTION}>
            <label htmlFor="transaction-detail-notes" style={FIELD_LABEL}>
              <FormattedMessage id="screen.transactionDetail.notes" defaultMessage="Notes" />
            </label>
            <textarea
              id="transaction-detail-notes"
              value={notes}
              onChange={(e) => {
                onNotes(e.target.value);
              }}
              rows={3}
              className="pbg-ctl pbg-ctl-field"
              style={TEXT_AREA_CONTROL}
            />
            {notesError !== null && (
              <p role="alert" style={ALERT_TEXT}>
                {notesError}
              </p>
            )}
            <div style={{ marginTop: 'var(--pb-glass-space-xs)' }}>
              <Button variant="primary" loading={savingNotes} onClick={onSaveNotes}>
                <FormattedMessage id="screen.transactionDetail.save" defaultMessage="Save" />
              </Button>
            </div>
          </div>

          {/* Actions section */}
          <div style={{ ...DIALOG_SECTION, flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              variant={isTransfer ? 'primary' : 'secondary'}
              loading={togglingTransfer}
              onClick={onToggleTransfer}
            >
              <FormattedMessage
                id="screen.transactionDetail.markTransfer"
                defaultMessage="Mark as transfer"
              />
            </Button>

            <Button
              variant={ignored ? 'danger' : 'secondary'}
              loading={togglingIgnored}
              onClick={onToggleIgnored}
            >
              <FormattedMessage id="screen.transactionDetail.ignore" defaultMessage="Ignore" />
            </Button>
          </div>
        </div>
      )}
      {mapDialog}
    </Sheet>
  );
}

function sourceLabel(intl: IntlShape, source: Transaction['source']): string {
  switch (source) {
    case 'bank_sync':
      return intl.formatMessage({
        id: 'screen.transactionDetail.source.bankSync',
        defaultMessage: 'Bank',
      });
    case 'manual':
      return intl.formatMessage({
        id: 'screen.transactionDetail.source.manual',
        defaultMessage: 'Manual',
      });
  }
}

function statusLabel(intl: IntlShape, status: Transaction['status']): string {
  switch (status) {
    case 'live':
    case 'pending':
      return intl.formatMessage({ id: 'transaction.status.pending', defaultMessage: 'Pending' });
    case 'booked':
    case 'manual':
      return intl.formatMessage({ id: 'transaction.status.booked', defaultMessage: 'Booked' });
    case 'cancelled':
    case 'expired':
      return intl.formatMessage({
        id: 'transaction.status.cancelled',
        defaultMessage: 'Cancelled',
      });
  }
}
