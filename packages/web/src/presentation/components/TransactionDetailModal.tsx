import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { MoneyView } from './MoneyView.js';
import { parseLocalIsoDate } from '@power-budget/core';
import { apiClient, plansApi } from '../../AppProviders.js';
import { TransactionMapModal } from './TransactionMapModal.js';
import { readApiError } from '@power-budget/shared-app';
import type { PatchTransactionDto, TransactionDetailDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';
import type { Transaction, TransactionMapping } from '../../domain/transactions/Transaction.js';
import { fetchCategoryNames } from '../../infrastructure/api/CategoryNames.js';
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
  const theme = useTheme();
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
    void loadPlannedItems(plansApi, () => fetchCategoryNames(apiClient)).then(
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

  const sourceLabel = (source: Transaction['source']): string => {
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
  };

  const statusLabel = (status: Transaction['status']): string => {
    switch (status) {
      case 'pending':
        return intl.formatMessage({ id: 'transaction.status.pending', defaultMessage: 'Pending' });
      case 'posted':
        return intl.formatMessage({ id: 'transaction.status.posted', defaultMessage: 'Booked' });
      case 'cancelled':
        return intl.formatMessage({
          id: 'transaction.status.cancelled',
          defaultMessage: 'Cancelled',
        });
    }
  };

  const title = intl.formatMessage({
    id: 'screen.transactionDetail.title',
    defaultMessage: 'Transaction Details',
  });

  const sectionStyle: React.CSSProperties = {
    borderTop: `1px solid ${theme.color.border.subtle}`,
    paddingTop: theme.space.md,
    marginTop: theme.space.md,
  };

  const labelStyle: React.CSSProperties = {
    color: theme.color.text.secondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.space.xs,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: theme.color.surface.raised,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.subtle}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    fontSize: theme.fontSize.md,
    boxSizing: 'border-box',
    resize: 'vertical',
  };

  const mappedLabel = mapping === null ? undefined : catalogue?.labels.get(mapping.plannedItemId);
  const mappedCategoryName = mappedLabel?.categoryName ?? '';
  const mappedPlanName = mappedLabel?.planName ?? '';

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose}>
      {loading && (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </p>
      )}

      {fetchError !== null && <p style={{ color: theme.color.status.danger }}>{fetchError}</p>}

      {transaction !== null && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Transaction info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.xl }}>
                <MoneyView amount={transaction.amount} showTooltip />
              </span>
              <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
                {parseLocalIsoDate(transaction.occurredOn).toLocaleDateString(intl.locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div>
              <p
                style={{ margin: 0, fontSize: theme.fontSize.md, color: theme.color.text.primary }}
              >
                {transaction.description}
              </p>
              {transaction.merchant !== null &&
                transaction.merchant !== transaction.description && (
                  <p
                    style={{
                      margin: `${theme.space.xs}px 0 0 0`,
                      fontSize: theme.fontSize.sm,
                      color: theme.color.text.secondary,
                    }}
                  >
                    {transaction.merchant}
                  </p>
                )}
            </div>

            <p
              style={{ margin: 0, fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}
            >
              {[sourceLabel(transaction.source), statusLabel(transaction.status)].join(' · ')}
            </p>
          </div>

          {/* Mapping section: read-only here; the Map modal edits it */}
          <div style={sectionStyle}>
            <p style={labelStyle}>
              <FormattedMessage id="screen.transactionDetail.mapping" defaultMessage="Mapped to" />
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: theme.space.sm,
              }}
            >
              <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.primary }}>
                {isTransfer ? (
                  <FormattedMessage
                    id="component.transactionRow.transfer"
                    defaultMessage="Transfer"
                  />
                ) : mapping === null ? (
                  <FormattedMessage
                    id="screen.transactionDetail.notMapped"
                    defaultMessage="Not mapped"
                  />
                ) : (
                  <>
                    <span style={{ fontWeight: theme.fontWeight.medium }}>
                      {mappedCategoryName || mapping.plannedItemId}
                    </span>
                    {mappedPlanName !== '' && (
                      <span
                        style={{
                          fontSize: theme.fontSize.xs,
                          color: theme.color.text.secondary,
                          marginLeft: theme.space.sm,
                        }}
                      >
                        {mappedPlanName}
                      </span>
                    )}
                  </>
                )}
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowMapModal(true);
                }}
              >
                {mapping === null ? (
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
          <div style={sectionStyle}>
            <p style={labelStyle}>
              <FormattedMessage id="screen.transactionDetail.notes" defaultMessage="Notes" />
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              rows={3}
              style={inputStyle}
              placeholder={intl.formatMessage({
                id: 'screen.transactionDetail.notes',
                defaultMessage: 'Notes',
              })}
            />
            {notesError !== null && (
              <p
                style={{
                  color: theme.color.status.danger,
                  fontSize: theme.fontSize.sm,
                  margin: `${theme.space.xs}px 0 0`,
                }}
              >
                {notesError}
              </p>
            )}
            <div style={{ marginTop: theme.space.sm }}>
              <Button
                variant="primary"
                loading={savingNotes}
                onClick={() => {
                  void handleSaveNotes();
                }}
              >
                <FormattedMessage id="screen.transactionDetail.save" defaultMessage="Save" />
              </Button>
            </div>
          </div>

          {/* Actions section */}
          <div
            style={{
              ...sectionStyle,
              display: 'flex',
              gap: theme.space.sm,
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant={isTransfer ? 'primary' : 'secondary'}
              loading={togglingTransfer}
              onClick={() => {
                void handleToggleTransfer();
              }}
            >
              <FormattedMessage
                id="screen.transactionDetail.markTransfer"
                defaultMessage="Mark as transfer"
              />
            </Button>

            <Button
              variant={ignored ? 'danger' : 'secondary'}
              loading={togglingIgnored}
              onClick={() => {
                void handleToggleIgnored();
              }}
            >
              <FormattedMessage id="screen.transactionDetail.ignore" defaultMessage="Ignore" />
            </Button>
          </div>
        </div>
      )}
      {transaction !== null && (
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
      )}
    </Modal>
  );
}
