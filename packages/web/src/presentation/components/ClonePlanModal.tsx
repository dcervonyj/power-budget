import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Modal } from './Modal.js';
import { Select } from './Select.js';
import { CustomPeriodPicker } from './CustomPeriodPicker.js';
import type { CustomPeriodValue } from './CustomPeriodPicker.js';
import { useTheme } from './ThemeContext.js';
import { apiClient } from '../../AppProviders.js';

type PlanPeriod = 'weekly' | 'monthly' | 'custom';

export interface ClonePlanModalProps {
  readonly isOpen: boolean;
  readonly planId: string;
  readonly onClose: () => void;
  readonly onCloned: () => void;
}

export function ClonePlanModal({
  isOpen,
  planId,
  onClose,
  onCloned,
}: ClonePlanModalProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [period, setPeriod] = useState<PlanPeriod>('monthly');
  const [customDates, setCustomDates] = useState<CustomPeriodValue>({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions: ReadonlyArray<{ value: PlanPeriod; label: string }> = [
    {
      value: 'weekly',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodWeekly',
        defaultMessage: 'Weekly',
      }),
    },
    {
      value: 'monthly',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodMonthly',
        defaultMessage: 'Monthly',
      }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({
        id: 'modal.clonePlan.periodCustom',
        defaultMessage: 'Custom',
      }),
    },
  ];

  const handleClone = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/plans/${planId}/clone`, {
        period,
        ...(period === 'custom'
          ? { startDate: customDates.startDate, endDate: customDates.endDate }
          : {}),
      });
      onCloned();
      onClose();
    } catch {
      setError(
        intl.formatMessage({
          id: 'modal.clonePlan.cloneError',
          defaultMessage: 'Failed to clone plan',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = intl.formatMessage({
    id: 'modal.clonePlan.title',
    defaultMessage: 'Clone Plan',
  });

  const cancelLabel = intl.formatMessage({
    id: 'modal.clonePlan.cancelButton',
    defaultMessage: 'Cancel',
  });

  const cloneLabel = intl.formatMessage({
    id: 'modal.clonePlan.cloneButton',
    defaultMessage: 'Clone',
  });

  return (
    <Modal
      isOpen={isOpen}
      title={modalTitle}
      onClose={onClose}
      footerButtons={[
        { label: cancelLabel, variant: 'secondary', onClick: onClose },
        {
          label: cloneLabel,
          variant: 'primary',
          onClick: () => {
            void handleClone();
          },
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
        <Select<PlanPeriod>
          id="clone-period"
          label={intl.formatMessage({
            id: 'modal.clonePlan.periodLabel',
            defaultMessage: 'Period',
          })}
          options={periodOptions}
          value={period}
          onChange={setPeriod}
        />
        {period === 'custom' && (
          <CustomPeriodPicker value={customDates} onChange={setCustomDates} />
        )}
        {error !== null && (
          <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
            {error}
          </span>
        )}
        {loading && (
          <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="modal.clonePlan.cloning" defaultMessage="Cloning…" />
          </span>
        )}
      </div>
    </Modal>
  );
}
