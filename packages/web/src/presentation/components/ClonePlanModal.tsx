import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { Modal } from './Modal.js';
import { ClonePlanForm } from './ClonePlanForm.js';
import type { CustomPeriodValue } from './CustomPeriodPicker.js';
import type { ClonePlanDto, PlanPeriodKindDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../AppProviders.js';

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
  const intl = useIntl();
  const [period, setPeriod] = useState<PlanPeriodKindDto>('monthly');
  const [customDates, setCustomDates] = useState<CustomPeriodValue>({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClone = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // CLN-011: the clone keeps the period kind; without dates it covers the next period.
      const body: ClonePlanDto =
        period === 'custom'
          ? { periodStart: customDates.startDate, periodEnd: customDates.endDate }
          : {};
      await plansApi.clone(planId, body);
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
      <ClonePlanForm
        period={period}
        customDates={customDates}
        loading={loading}
        error={error}
        onPeriodChange={setPeriod}
        onCustomDatesChange={setCustomDates}
      />
    </Modal>
  );
}
