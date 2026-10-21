import React, { useEffect, useState, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { MoneyView } from './MoneyView.js';
import { formatMoney, parseLocalIsoDate, parseMinorUnits } from '@power-budget/core';
import { apiClient, plansApi } from '../../AppProviders.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';
import type {
  PatchTransactionDto,
  PlanDto,
  PlannedItemDto,
  SetMappingDto,
  TransactionDetailDto,
} from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';
import type { Transaction, TransactionMapping } from '../../domain/transactions/Transaction.js';
import { fetchCategoryNames } from '../../infrastructure/api/CategoryNames.js';

export type { Transaction, TransactionMapping } from '../../domain/transactions/Transaction.js';

export interface TransactionDetailModalProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (tx: Transaction) => void;
}

export function TransactionDetailModal({
  transactionId,
  isOpen,
  onClose,
  onUpdated,
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
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [isTransfer, setIsTransfer] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [togglingTransfer, setTogglingTransfer] = useState(false);
  const [togglingIgnored, setTogglingIgnored] = useState(false);

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [planItems, setPlanItems] = useState<Map<string, PlannedItemDto[]>>(new Map());
  const [categoryNames, setCategoryNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Reset state when opening a new transaction
  useEffect(() => {
    if (!isOpen) return;
    setTransaction(null);
    setFetchError(null);
    setNotes('');
    setMapping(null);
    setIsTransfer(false);
    setIgnored(false);
    setShowPicker(false);
    setMappingError(null);
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
      } catch {
        if (!cancelled) {
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

  const loadPickerData = useCallback(async (): Promise<void> => {
    if (plans.length > 0) return;
    setPickerLoading(true);
    try {
      const [activePlans, names] = await Promise.all([
        plansApi.list('active'),
        fetchCategoryNames(apiClient),
      ]);
      setPlans(activePlans);
      setCategoryNames(names);
      const itemResults = await Promise.all(
        activePlans.map(async (p) => ({ planId: p.id, items: await plansApi.listItems(p.id) })),
      );
      setPlanItems(new Map(itemResults.map(({ planId, items }) => [planId, items])));
    } catch {
      // ignore — picker will be empty
    } finally {
      setPickerLoading(false);
    }
  }, [plans.length]);

  // A mapped transaction needs the plans and items to name its planned item.
  useEffect(() => {
    if (mapping !== null) {
      void loadPickerData();
    }
  }, [mapping, loadPickerData]);

  const handleShowPicker = (): void => {
    setShowPicker(true);
    void loadPickerData();
  };

  const handleMap = useCallback(
    async (plannedItemId: string | null): Promise<void> => {
      const previousMapping = mapping;

      let newMapping: TransactionMapping | null = null;
      if (plannedItemId !== null) {
        for (const [planId, items] of planItems) {
          const item = items.find((i) => i.id === plannedItemId);
          if (item) {
            const plan = plans.find((p) => p.id === planId);
            const categoryName = categoryNames.get(item.categoryId) ?? '';
            newMapping = {
              plannedItemId: item.id,
              plannedItemName: `${plan?.name ?? ''}${categoryName ? ` — ${categoryName}` : ''}`,
              categoryId: item.categoryId,
              categoryName,
            };
            break;
          }
        }
      }

      // Optimistic update
      setMapping(newMapping);
      setShowPicker(false);
      setMappingLoading(true);
      setMappingError(null);

      try {
        const body: SetMappingDto = { plannedItemId };
        await apiClient.patch(`/transactions/${transactionId}/mapping`, body);
        const updatedTx: Transaction | null = transaction
          ? {
              ...transaction,
              mapping: newMapping,
              mappingStatus: newMapping === null ? 'unmapped' : 'mapped',
            }
          : null;
        if (updatedTx) {
          setTransaction(updatedTx);
          onUpdated?.(updatedTx);
        }
      } catch {
        // Rollback
        setMapping(previousMapping);
        setMappingError(
          intl.formatMessage({
            id: 'screen.transactionDetail.mappingError',
            defaultMessage: 'Failed to update mapping',
          }),
        );
      } finally {
        setMappingLoading(false);
      }
    },
    [mapping, planItems, plans, categoryNames, transactionId, transaction, onUpdated, intl],
  );

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

  // Build picker items: suggestions (current mapping item) float to top
  const pickerItems: Array<{ planId: string; planName: string; item: PlannedItemDto }> = [];
  for (const plan of plans) {
    const items = planItems.get(plan.id) ?? [];
    for (const item of items) {
      pickerItems.push({ planId: plan.id, planName: plan.name, item });
    }
  }
  // Float current mapping's item to top
  const currentMappedId = mapping?.plannedItemId;
  // GET /transactions/:id returns only the planned item id; the names come from the
  // plans and categories loaded for the picker.
  const mappedEntry = pickerItems.find(({ item }) => item.id === currentMappedId);
  const mappedCategoryName =
    mapping?.categoryName ||
    (mappedEntry ? (categoryNames.get(mappedEntry.item.categoryId) ?? '') : '');
  const mappedPlanName = mapping?.plannedItemName || (mappedEntry?.planName ?? '');
  pickerItems.sort((a, b) => {
    if (a.item.id === currentMappedId) return -1;
    if (b.item.id === currentMappedId) return 1;
    return 0;
  });

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
              {sourceLabel(transaction.source)}
            </p>
          </div>

          {/* Mapping section */}
          <div style={sectionStyle}>
            <p style={labelStyle}>
              <FormattedMessage id="screen.transactionDetail.mapping" defaultMessage="Mapped to" />
            </p>

            {mappingError !== null && (
              <p
                style={{
                  color: theme.color.status.danger,
                  fontSize: theme.fontSize.sm,
                  margin: `0 0 ${theme.space.sm}px`,
                }}
              >
                {mappingError}
              </p>
            )}

            {mapping !== null && !showPicker && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.space.sm,
                  backgroundColor: theme.color.surface.raised,
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${theme.color.border.subtle}`,
                  marginBottom: theme.space.sm,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.medium,
                      color: theme.color.text.primary,
                    }}
                  >
                    {mappedCategoryName || mapping.plannedItemId}
                  </span>
                  {mappedPlanName && (
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
                </div>
                <Button
                  variant="danger"
                  disabled={mappingLoading}
                  onClick={() => {
                    void handleMap(null);
                  }}
                >
                  <FormattedMessage
                    id="screen.transactionDetail.unmap"
                    defaultMessage="Clear mapping"
                  />
                </Button>
              </div>
            )}

            {!showPicker && (
              <Button variant="secondary" loading={mappingLoading} onClick={handleShowPicker}>
                <FormattedMessage
                  id="screen.transactionDetail.mapTo"
                  defaultMessage="Map to planned item"
                />
              </Button>
            )}

            {showPicker && (
              <div
                style={{
                  border: `1px solid ${theme.color.border.subtle}`,
                  borderRadius: theme.radius.sm,
                  overflow: 'hidden',
                }}
              >
                {pickerLoading && (
                  <p
                    style={{
                      color: theme.color.text.secondary,
                      padding: theme.space.md,
                      margin: 0,
                    }}
                  >
                    <FormattedMessage id="app.loading" defaultMessage="Loading…" />
                  </p>
                )}
                {!pickerLoading && pickerItems.length === 0 && (
                  <p
                    style={{
                      color: theme.color.text.secondary,
                      padding: theme.space.md,
                      margin: 0,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    <FormattedMessage
                      id="screen.transactionDetail.noPlannedItems"
                      defaultMessage="No planned items available"
                    />
                  </p>
                )}
                {pickerItems.map(({ planName, item }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      void handleMap(item.id);
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: `${theme.space.sm}px ${theme.space.md}px`,
                      backgroundColor:
                        item.id === currentMappedId
                          ? `${theme.color.accent.default}22`
                          : theme.color.surface.raised,
                      border: 'none',
                      borderBottom: `1px solid ${theme.color.border.subtle}`,
                      cursor: 'pointer',
                      color: theme.color.text.primary,
                      textAlign: 'left',
                    }}
                  >
                    <span>
                      <span
                        style={{
                          fontSize: theme.fontSize.sm,
                          fontWeight: theme.fontWeight.medium,
                        }}
                      >
                        {categoryNames.get(item.categoryId) ?? item.categoryId}
                      </span>
                      <span
                        style={{
                          fontSize: theme.fontSize.xs,
                          color: theme.color.text.secondary,
                          marginLeft: theme.space.sm,
                        }}
                      >
                        {intl.formatMessage(
                          {
                            id: 'modal.transactionDetail.planAndDirection',
                            defaultMessage: '{planName} · {direction}',
                          },
                          { planName, direction: item.direction },
                        )}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: theme.fontSize.sm,
                        color: theme.color.text.secondary,
                        marginLeft: theme.space.md,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMoney(
                        {
                          amountMinor: parseMinorUnits(item.amount.amountMinor),
                          currency: item.amount.currency,
                        },
                        toSupportedLocale(intl.locale),
                      )}
                    </span>
                  </button>
                ))}
                <div style={{ padding: theme.space.sm }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowPicker(false);
                    }}
                  >
                    <FormattedMessage id="common.cancel" defaultMessage="Cancel" />
                  </Button>
                </div>
              </div>
            )}
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
    </Modal>
  );
}
