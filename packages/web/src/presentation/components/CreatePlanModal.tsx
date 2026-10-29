import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useIntl } from 'react-intl';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../composition.js';
import { CreatePlanStore } from '../../application/plans/CreatePlanStore.js';
import { CreatePlanForm } from './CreatePlanForm.js';
import { Modal } from './Modal.js';

export interface CreatePlanModalProps {
  readonly isOpen: boolean;
  /** Whether the user belongs to a household: only then is the household type offered. */
  readonly hasHousehold: boolean;
  /** The profile currency, the default base currency of the new plan. */
  readonly profileCurrency: string;
  readonly onClose: () => void;
  readonly onCreated: (plan: PlanDto) => void;
}

export const CreatePlanModal = observer(function CreatePlanModal({
  isOpen,
  hasHousehold,
  profileCurrency,
  onClose,
  onCreated,
}: CreatePlanModalProps): React.JSX.Element {
  const intl = useIntl();
  const [store] = useState(
    () => new CreatePlanStore(plansApi, hasHousehold, new Date(), profileCurrency),
  );

  async function handleCreate(): Promise<void> {
    const created = await store.submit();
    if (created !== null) {
      onCreated(created);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={intl.formatMessage({ id: 'modal.createPlan.title', defaultMessage: 'Create plan' })}
      onClose={onClose}
      footerButtons={[
        {
          label: intl.formatMessage({
            id: 'modal.createPlan.cancelButton',
            defaultMessage: 'Cancel',
          }),
          variant: 'secondary',
          onClick: onClose,
        },
        {
          label: intl.formatMessage({
            id: 'modal.createPlan.createButton',
            defaultMessage: 'Create',
          }),
          variant: 'primary',
          loading: store.submitting,
          onClick: () => {
            void handleCreate();
          },
        },
      ]}
    >
      <CreatePlanForm
        draft={store.draft}
        errors={store.errors}
        typeOptions={store.typeOptions}
        derivedEndDate={store.derivedEndDate}
        submitError={store.submitError}
        onNameChange={(name) => {
          store.setName(name);
        }}
        onTypeChange={(type) => {
          store.setType(type);
        }}
        onPeriodKindChange={(kind) => {
          store.setPeriodKind(kind);
        }}
        onStartDateChange={(date) => {
          store.setStartDate(date);
        }}
        onEndDateChange={(date) => {
          store.setEndDate(date);
        }}
        onBaseCurrencyChange={(currency) => {
          store.setBaseCurrency(currency);
        }}
      />
    </Modal>
  );
});
