import React from 'react';
import { useIntl } from 'react-intl';
import { FormattedMessage } from 'react-intl';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';
import type { PlannedItem, Direction } from './usePlanEditor.js';

interface PlannedItemRowProps {
  item: PlannedItem;
  planId: string;
  inlineInputStyle: React.CSSProperties;
  cellStyle: React.CSSProperties;
  onUpdate: (
    item: PlannedItem,
    changes: Partial<Pick<PlannedItem, 'amountMinor' | 'currency'>>,
  ) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  onHistoryClick: (planId: string, itemId: string) => void;
  onDirectionChange: (item: PlannedItem, direction: Direction) => void;
}

export function PlannedItemRow({
  item,
  planId,
  inlineInputStyle,
  cellStyle,
  onUpdate,
  onRemove,
  onHistoryClick,
  onDirectionChange,
}: PlannedItemRowProps): React.JSX.Element {
  const intl = useIntl();

  const directionOptions: ReadonlyArray<{ value: Direction; label: string }> = [
    {
      value: 'income',
      label: intl.formatMessage({
        id: 'screen.planEditor.itemDirectionIncome',
        defaultMessage: 'Income',
      }),
    },
    {
      value: 'expense',
      label: intl.formatMessage({
        id: 'screen.planEditor.itemDirectionExpense',
        defaultMessage: 'Expense',
      }),
    },
  ];

  return (
    <tr>
      <td style={cellStyle}>{item.categoryName ?? item.categoryId}</td>
      <td style={cellStyle}>
        <Select<Direction>
          options={directionOptions}
          value={item.direction}
          onChange={(val) => {
            onDirectionChange(item, val);
          }}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="number"
          value={item.amountMinor}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!isNaN(parsed)) {
              void onUpdate(item, { amountMinor: parsed });
            }
          }}
          aria-label={intl.formatMessage({
            id: 'screen.planEditor.itemAmountPlaceholder',
            defaultMessage: 'Amount',
          })}
          style={inlineInputStyle}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="text"
          value={item.currency}
          onChange={(e) => {
            void onUpdate(item, { currency: e.target.value });
          }}
          aria-label={intl.formatMessage({
            id: 'screen.planEditor.itemCurrencyPlaceholder',
            defaultMessage: 'Currency',
          })}
          style={inlineInputStyle}
        />
      </td>
      <td style={cellStyle}>
        <Button
          variant="secondary"
          onClick={() => {
            onHistoryClick(planId, item.id);
          }}
        >
          {intl.formatMessage({ id: 'screen.planEditor.historyButton', defaultMessage: 'History' })}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            void onRemove(item.id);
          }}
        >
          <FormattedMessage
            id="screen.planEditor.removeItemButton"
            defaultMessage="Remove"
          />
        </Button>
      </td>
    </tr>
  );
}
