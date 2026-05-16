import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Button } from './Button.js';
import type { TransactionMapping } from './useTransactionDetail.js';

interface PlannedItem {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: 'income' | 'expense';
  amountMinor: number;
  currency: string;
}

interface TransactionMappingSectionProps {
  mapping: TransactionMapping | null;
  showPicker: boolean;
  pickerItems: Array<{ planId: string; planName: string; item: PlannedItem }>;
  mappingLoading: boolean;
  mappingError: string | null;
  pickerLoading: boolean;
  currentMappedId: string | undefined;
  onShowPicker: () => void;
  onMap: (plannedItemId: string | null) => Promise<void>;
  onCancelPicker: () => void;
  sectionStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}

export function TransactionMappingSection({
  mapping,
  showPicker,
  pickerItems,
  mappingLoading,
  mappingError,
  pickerLoading,
  currentMappedId,
  onShowPicker,
  onMap,
  onCancelPicker,
  sectionStyle,
  labelStyle,
}: TransactionMappingSectionProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  return (
    <div style={sectionStyle}>
      <p style={labelStyle}>
        <FormattedMessage
          id="screen.transactionDetail.mapping"
          defaultMessage="Mapped to"
        />
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
              {mapping.categoryName}
            </span>
            {mapping.plannedItemName && (
              <span
                style={{
                  fontSize: theme.fontSize.xs,
                  color: theme.color.text.secondary,
                  marginLeft: theme.space.sm,
                }}
              >
                {mapping.plannedItemName}
              </span>
            )}
          </div>
          <Button
            variant="danger"
            disabled={mappingLoading}
            onClick={() => {
              void onMap(null);
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
        <Button variant="secondary" loading={mappingLoading} onClick={onShowPicker}>
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
                void onMap(item.id);
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
                  {item.categoryName ?? item.categoryId}
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
                {item.currency} {(item.amountMinor / 100).toFixed(2)}
              </span>
            </button>
          ))}
          <div style={{ padding: theme.space.sm }}>
            <Button variant="secondary" onClick={onCancelPicker}>
              <FormattedMessage id="common.cancel" defaultMessage="Cancel" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
