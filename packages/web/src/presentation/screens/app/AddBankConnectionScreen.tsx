import { bankConnectionStore } from '../../../composition.js';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  banksFor,
  previousStep,
  type Bank,
  type Provider,
  type Step,
} from '../../../application/bank/addBankFlow.js';
import { consentRedirectUri, goToConsent } from '../../../application/bank/consentRedirect.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { AddBankConnectionView } from '../../components/bank/AddBankConnectionView.js';

export function AddBankConnectionScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function connect(): Promise<void> {
    if (provider === null || selectedBank === null) {
      return;
    }
    setSubmitting(true);
    setFailed(false);
    const consentUrl = await bankConnectionStore.connect(
      provider,
      selectedBank.id,
      consentRedirectUri(),
    );
    setSubmitting(false);
    if (consentUrl === null) {
      setFailed(true);

      return;
    }
    goToConsent(consentUrl);
  }

  function back(): void {
    if (step === 'provider') {
      void navigate(ROUTE_PATHS.bankConnections);

      return;
    }
    setFailed(false);
    setStep(previousStep(step));
  }

  return (
    <AddBankConnectionView
      step={step}
      provider={provider}
      banks={banksFor(provider, bankSearch)}
      bankSearch={bankSearch}
      selectedBank={selectedBank}
      submitting={submitting}
      failed={failed}
      onProvider={(chosen) => {
        setProvider(chosen);
        setStep('bank');
      }}
      onSearch={setBankSearch}
      onBank={(bank) => {
        setSelectedBank(bank);
        setStep('scope');
      }}
      onBack={back}
      onNext={() => {
        setStep('connect');
      }}
      onConnect={() => {
        void connect();
      }}
    />
  );
}
