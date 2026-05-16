import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';
import { apiClient } from '../../AppProviders.js';

interface Plan {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'archived';
}

interface PlannedItem {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: 'income' | 'expense';
  amountMinor: number;
  currency: string;
}

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
  const theme = useTheme();
  const intl = useIntl();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [items, setItems] = useState<PlannedItem[]>([]);
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
        const res = await apiClient.get<Plan[]>('/plans?status=active');
        const fetched = res.data as Plan[];
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
        const res = await apiClient.get<PlannedItem[]>(`/plans/${selectedPlanId}/items`);
        const fetched = res.data as PlannedItem[];
        setItems(fetched);
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
      await apiClient.post('/transactions/bulk', {
        action: 'map',
        ids: Array.from(selectedIds),
        plannedItemId: selectedItemId,
      });
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

  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      footerButtons={[
        {
          label: intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' }),
          variant: 'secondary',
          onClick: onClose,
        },
        {
          label: intl.formatMessage(
            { id: 'mapping.confirm', defaultMessage: 'Map ({count})' },
            { count },
          ),
          variant: 'primary',
          onClick: () => void handleConfirm(),
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.lg }}>
        {error !== null && <p style={{ color: theme.color.status.danger, margin: 0 }}>{error}</p>}

        <div>
          <label
            htmlFor="mapping-plan-select"
            style={{
              display: 'block',
              marginBottom: theme.space.xs,
              color: theme.color.text.secondary,
              fontSize: theme.fontSize.sm,
            }}
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
            style={{
              width: '100%',
              backgroundColor: theme.color.surface.raised,
              color: theme.color.text.primary,
              border: `1px solid ${theme.color.border.strong}`,
              borderRadius: theme.radius.md,
              padding: `${theme.space.sm}px ${theme.space.md}px`,
              fontSize: theme.fontSize.md,
            }}
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
            <p
              style={{
                margin: `0 0 ${theme.space.sm}px 0`,
                color: theme.color.text.secondary,
                fontSize: theme.fontSize.sm,
              }}
            >
              <FormattedMessage id="mapping.itemLabel" defaultMessage="Planned item" />
            </p>

            {itemsLoading && (
              <p style={{ color: theme.color.text.secondary }}>
                <FormattedMessage id="common.loading" defaultMessage="Loading..." />
              </p>
            )}

            {!itemsLoading && items.length === 0 && (
              <p style={{ color: theme.color.text.secondary }}>
                <FormattedMessage id="mapping.noItems" defaultMessage="No planned items" />
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
              {items.map((item, index) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.space.sm,
                    cursor: 'pointer',
                    padding: `${theme.space.sm}px ${theme.space.md}px`,
                    borderRadius: theme.radius.md,
                    backgroundColor:
                      selectedItemId === item.id
                        ? `${theme.color.accent.default}22`
                        : 'transparent',
                    border: `1px solid ${
                      selectedItemId === item.id
                        ? theme.color.accent.default
                        : theme.color.border.subtle
                    }`,
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
                  />
                  <span style={{ flex: 1, color: theme.color.text.primary }}>
                    {item.categoryName ?? item.categoryId}
                  </span>
                  {index === 0 && (
                    <span
                      style={{
                        fontSize: theme.fontSize.xs,
                        color: theme.color.accent.default,
                        backgroundColor: `${theme.color.accent.default}22`,
                        border: `1px solid ${theme.color.accent.default}`,
                        borderRadius: theme.radius.sm,
                        padding: `2px ${theme.space.sm}px`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <FormattedMessage id="mapping.suggested" defaultMessage="Suggested" />
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
