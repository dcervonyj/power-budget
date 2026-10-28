import { bulkTransactionActions, referenceCatalogue } from '../../composition.js';
import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from './Button.js';
import { Sheet } from '../glass/overlays/Sheet.js';
import {
  ALERT_TEXT,
  DIALOG_COLUMN,
  FIELD_CONTROL,
  FIELD_LABEL,
  MUTED_TEXT,
  optionStyle,
} from './transactionDialogStyles.js';
import type { PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';

export interface MappingModalProps {
  readonly isOpen: boolean;
  readonly selectedIds: ReadonlyArray<string>;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

export function MappingModal({
  isOpen,
  selectedIds,
  onClose,
  onSuccess,
}: MappingModalProps): React.JSX.Element | null {
  const intl = useIntl();

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [items, setItems] = useState<PlannedItemDto[]>([]);
  const [categoryNames, setCategoryNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlanId(null);
      setSelectedItemId(null);
      setItems([]);
      setError(null);
      return;
    }
    setPlansLoading(true);
    void (async () => {
      try {
        const fetched = await referenceCatalogue.activePlans();
        setPlans(fetched);
        setSelectedPlanId(fetched[0]?.id ?? null);
      } finally {
        setPlansLoading(false);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPlanId) {
      setItems([]);
      setSelectedItemId(null);
      return;
    }
    setItemsLoading(true);
    setSelectedItemId(null);
    void (async () => {
      try {
        const [fetched, names] = await Promise.all([
          referenceCatalogue.items(selectedPlanId),
          referenceCatalogue.categoryNames(),
        ]);
        setItems(fetched);
        setCategoryNames(names);
        setSelectedItemId(fetched[0]?.id ?? null);
      } finally {
        setItemsLoading(false);
      }
    })();
  }, [selectedPlanId]);

  const handleConfirm = async (): Promise<void> => {
    if (!selectedItemId) return;
    setSubmitting(true);
    setError(null);
    try {
      await bulkTransactionActions.map(selectedIds, selectedItemId);
      onSuccess();
      onClose();
    } catch {
      setError(
        intl.formatMessage({
          id: 'mapping.error',
          defaultMessage: 'Failed to map transactions',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const count = selectedIds.length;
  const title = intl.formatMessage(
    { id: 'mapping.title', defaultMessage: 'Map {count} transactions' },
    { count },
  );
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
      </Button>
      <Button
        variant="primary"
        disabled={submitting}
        onClick={() => {
          void handleConfirm();
        }}
      >
        {intl.formatMessage({ id: 'mapping.confirm', defaultMessage: 'Map ({count})' }, { count })}
      </Button>
    </>
  );

  return (
    <Sheet title={title} isOpen={isOpen} onClose={onClose} footer={footer}>
      <div style={{ ...DIALOG_COLUMN, gap: 'var(--pb-glass-space-lg)' }}>
        {error !== null && (
          <p role="alert" style={ALERT_TEXT}>
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="mapping-plan-select"
            style={{ ...FIELD_LABEL, marginBottom: 'var(--pb-glass-space-xs)' }}
          >
            <FormattedMessage id="mapping.planLabel" defaultMessage="Plan" />
          </label>
          <select
            id="mapping-plan-select"
            value={selectedPlanId ?? ''}
            onChange={(e) => {
              setSelectedPlanId(e.target.value || null);
            }}
            disabled={plansLoading || submitting}
            className="pbg-ctl"
            style={FIELD_CONTROL}
          >
            {plansLoading && (
              <option value="">
                {intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading...' })}
              </option>
            )}
            {!plansLoading && plans.length === 0 && (
              <option value="">
                {intl.formatMessage({
                  id: 'mapping.noActivePlans',
                  defaultMessage: 'No active plans',
                })}
              </option>
            )}
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPlanId !== null && (
          <div>
            <p style={{ ...FIELD_LABEL, marginBottom: 'var(--pb-glass-space-sm)' }}>
              <FormattedMessage id="mapping.itemLabel" defaultMessage="Planned item" />
            </p>

            {itemsLoading && (
              <p style={MUTED_TEXT}>
                <FormattedMessage id="common.loading" defaultMessage="Loading..." />
              </p>
            )}

            {!itemsLoading && items.length === 0 && (
              <p style={MUTED_TEXT}>
                <FormattedMessage id="mapping.noItems" defaultMessage="No planned items" />
              </p>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--pb-glass-space-xs)',
                padding: 2,
              }}
            >
              {items.map((item) => (
                <label
                  key={item.id}
                  style={{
                    ...optionStyle(selectedItemId === item.id),
                    justifyContent: 'flex-start',
                  }}
                >
                  <input
                    type="radio"
                    name="planned-item"
                    value={item.id}
                    checked={selectedItemId === item.id}
                    onChange={() => {
                      setSelectedItemId(item.id);
                    }}
                    disabled={submitting}
                    style={{ width: 20, height: 20, accentColor: 'var(--pb-glass-fg)' }}
                  />
                  <span style={{ flex: 1 }}>
                    {categoryNames.get(item.categoryId) ?? item.categoryId}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
