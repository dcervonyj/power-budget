import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { MoneyView } from './MoneyView.js';
import { useTransactionDetail } from './useTransactionDetail.js';
import { TransactionStatusBadge } from './TransactionStatusBadge.js';
import { TransactionMappingSection } from './TransactionMappingSection.js';
export type { Transaction, TransactionMapping } from './useTransactionDetail.js';

export interface TransactionDetailModalProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (tx: import('./useTransactionDetail.js').Transaction) => void;
}

export function TransactionDetailModal({
  transactionId,
  isOpen,
  onClose,
  onUpdated,
}: TransactionDetailModalProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();

  const {
    transaction,
    loading,
    fetchError,
    notes,
    setNotes,
    savingNotes,
    notesError,
    mapping,
    mappingLoading,
    mappingError,
    isTransfer,
    ignored,
    togglingTransfer,
    togglingIgnored,
    showPicker,
    setShowPicker,
    pickerLoading,
    pickerItems,
    currentMappedId,
    handleSaveNotes,
    handleMap,
    handleShowPicker,
    handleToggleTransfer,
    handleToggleIgnored,
  } = useTransactionDetail(transactionId, isOpen, onUpdated);

  const sourceLabel = (source: 'gocardless' | 'wise' | 'manual'): string => {
    switch (source) {
      case 'gocardless':
        return intl.formatMessage({
          id: 'screen.transactionDetail.source.gocardless',
          defaultMessage: 'Bank (GoCardless)',
        });
      case 'wise':
        return intl.formatMessage({
          id: 'screen.transactionDetail.source.wise',
          defaultMessage: 'Wise',
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

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose}>
      {loading && (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </p>
      )}

      {fetchError !== null && (
        <p style={{ color: theme.color.status.danger }}>{fetchError}</p>
      )}

      {transaction !== null && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Transaction info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{ fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.xl }}
              >
                <MoneyView
                  amountMinor={transaction.amountMinor}
                  currency={transaction.currency}
                  showTooltip
                />
              </span>
              <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
                {new Date(transaction.occurredOn).toLocaleDateString(intl.locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div>
              <p style={{ margin: 0, fontSize: theme.fontSize.md, color: theme.color.text.primary }}>
                {transaction.description}
              </p>
              {transaction.merchant !== null && transaction.merchant !== transaction.description && (
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

            <p style={{ margin: 0, fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              {sourceLabel(transaction.source)}
            </p>

            <TransactionStatusBadge isTransfer={isTransfer} ignored={ignored} />
          </div>

          {/* Mapping section */}
          <TransactionMappingSection
            mapping={mapping}
            showPicker={showPicker}
            pickerItems={pickerItems}
            mappingLoading={mappingLoading}
            mappingError={mappingError}
            pickerLoading={pickerLoading}
            currentMappedId={currentMappedId}
            onShowPicker={handleShowPicker}
            onMap={handleMap}
            onCancelPicker={() => {
              setShowPicker(false);
            }}
            sectionStyle={sectionStyle}
            labelStyle={labelStyle}
          />

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
