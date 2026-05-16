import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { apiClient } from '../../../AppProviders.js';

type Provider = 'gocardless' | 'wise';
type Step = 'provider' | 'bank' | 'history' | 'connect' | 'review';

const HISTORY_OPTIONS = [30, 60, 90, 180] as const;

interface Bank {
  id: string;
  name: string;
  provider: Provider;
}

const MOCK_BANKS: Bank[] = [
  { id: 'pko_bp', name: 'PKO BP', provider: 'gocardless' },
  { id: 'mbank', name: 'mBank', provider: 'gocardless' },
  { id: 'ing', name: 'ING Bank', provider: 'gocardless' },
  { id: 'santander', name: 'Santander', provider: 'gocardless' },
  { id: 'millennium', name: 'Bank Millennium', provider: 'gocardless' },
  { id: 'alior', name: 'Alior Bank', provider: 'gocardless' },
  { id: 'wise', name: 'Wise', provider: 'wise' },
];

export function AddBankConnectionScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [historyDays, setHistoryDays] = useState<(typeof HISTORY_OPTIONS)[number]>(90);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredBanks = MOCK_BANKS.filter(
    (b) =>
      (provider === null || b.provider === provider) &&
      b.name.toLowerCase().includes(bankSearch.toLowerCase()),
  );

  const handleProviderSelect = (p: Provider): void => {
    setProvider(p);
    setStep('bank');
  };

  const handleBankSelect = (bank: Bank): void => {
    setSelectedBank(bank);
    setStep('history');
  };

  const handleConnect = async (): Promise<void> => {
    if (!provider || !selectedBank) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post('/bank-connections', {
        provider,
        bankId: selectedBank.id,
        historyDays,
      });
      setStep('review');
    } catch {
      setSubmitError(
        intl.formatMessage({
          id: 'addBank.connectError',
          defaultMessage: 'Failed to connect. Please try again.',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: theme.space['2xl'],
    maxWidth: 560,
    margin: '0 auto',
    color: theme.color.text.primary,
  };

  const stepTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.space.xl,
    margin: `0 0 ${String(theme.space.xl)}px 0`,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.color.surface.raised,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    cursor: 'pointer',
    border: `1px solid ${theme.color.border.subtle}`,
    transition: 'border-color 0.15s',
  };

  if (step === 'provider') {
    return (
      <div style={containerStyle}>
        <h1 style={stepTitleStyle}>
          <FormattedMessage id="addBank.step.provider.title" />
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
          <button
            type="button"
            style={{ ...cardStyle, textAlign: 'left' }}
            onClick={() => {
              handleProviderSelect('gocardless');
            }}
          >
            <div
              style={{
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
                color: theme.color.text.primary,
              }}
            >
              <FormattedMessage
                id="addBank.provider.gocardless.name"
                defaultMessage="GoCardless (PSD2 banks)"
              />
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              <FormattedMessage
                id="addBank.provider.gocardless.description"
                defaultMessage="Connect EU banks via Open Banking (PSD2)"
              />
            </div>
          </button>
          <button
            type="button"
            style={{ ...cardStyle, textAlign: 'left' }}
            onClick={() => {
              handleProviderSelect('wise');
            }}
          >
            <div
              style={{
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
                color: theme.color.text.primary,
              }}
            >
              <FormattedMessage id="addBank.provider.wise.name" defaultMessage="Wise" />
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              <FormattedMessage
                id="addBank.provider.wise.description"
                defaultMessage="Connect your Wise account directly"
              />
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'bank') {
    return (
      <div style={containerStyle}>
        <h1 style={stepTitleStyle}>
          <FormattedMessage id="addBank.step.bank.title" />
        </h1>
        <Input
          value={bankSearch}
          onChange={setBankSearch}
          placeholder={intl.formatMessage({
            id: 'addBank.bankSearch.placeholder',
            defaultMessage: 'Search banks…',
          })}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.space.sm,
            marginTop: theme.space.md,
          }}
        >
          {filteredBanks.map((bank) => (
            <button
              key={bank.id}
              type="button"
              style={{ ...cardStyle, textAlign: 'left' }}
              onClick={() => {
                handleBankSelect(bank);
              }}
            >
              <span
                style={{
                  fontSize: theme.fontSize.md,
                  fontWeight: theme.fontWeight.medium,
                  color: theme.color.text.primary,
                }}
              >
                {bank.name}
              </span>
            </button>
          ))}
          {filteredBanks.length === 0 && (
            <p style={{ color: theme.color.text.secondary }}>
              <FormattedMessage
                id="addBank.bankSearch.empty"
                defaultMessage="No banks found. Try a different search."
              />
            </p>
          )}
        </div>
        <div style={{ marginTop: theme.space.lg }}>
          <Button
            variant="secondary"
            onClick={() => {
              setStep('provider');
            }}
          >
            <FormattedMessage id="common.back" defaultMessage="Back" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'history') {
    return (
      <div style={containerStyle}>
        <h1 style={stepTitleStyle}>
          <FormattedMessage id="addBank.step.history.title" />
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
          {HISTORY_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              style={{
                ...cardStyle,
                textAlign: 'left',
                borderColor:
                  historyDays === days ? theme.color.accent.default : theme.color.border.subtle,
              }}
              onClick={() => {
                setHistoryDays(days);
              }}
            >
              <span
                style={{ color: theme.color.text.primary, fontWeight: theme.fontWeight.medium }}
              >
                <FormattedMessage
                  id="addBank.historyOption"
                  defaultMessage="{days} days"
                  values={{ days }}
                />
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: theme.space.sm, marginTop: theme.space.xl }}>
          <Button
            variant="secondary"
            onClick={() => {
              setStep('bank');
            }}
          >
            <FormattedMessage id="common.back" defaultMessage="Back" />
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setStep('connect');
            }}
          >
            <FormattedMessage id="common.next" defaultMessage="Next" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'connect') {
    return (
      <div style={containerStyle}>
        <h1 style={stepTitleStyle}>
          <FormattedMessage id="addBank.step.connect.title" />
        </h1>
        <div
          style={{
            backgroundColor: theme.color.surface.raised,
            borderRadius: theme.radius.lg,
            padding: theme.space.lg,
            marginBottom: theme.space.xl,
          }}
        >
          <div style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="addBank.summary.bank" defaultMessage="Bank" />
          </div>
          <div
            style={{
              color: theme.color.text.primary,
              fontWeight: theme.fontWeight.medium,
              marginBottom: theme.space.sm,
            }}
          >
            {selectedBank?.name}
          </div>
          <div style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="addBank.summary.history" defaultMessage="History" />
          </div>
          <div style={{ color: theme.color.text.primary, fontWeight: theme.fontWeight.medium }}>
            <FormattedMessage
              id="addBank.historyOption"
              defaultMessage="{days} days"
              values={{ days: historyDays }}
            />
          </div>
        </div>

        {submitError !== null && (
          <p style={{ color: theme.color.status.danger, marginBottom: theme.space.md }}>
            {submitError}
          </p>
        )}

        <div style={{ display: 'flex', gap: theme.space.sm }}>
          <Button
            variant="secondary"
            onClick={() => {
              setStep('history');
            }}
          >
            <FormattedMessage id="common.back" defaultMessage="Back" />
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            onClick={() => {
              void handleConnect();
            }}
          >
            <FormattedMessage id="addBank.connectButton" defaultMessage="Connect bank" />
          </Button>
        </div>
      </div>
    );
  }

  // step === 'review'
  return (
    <div style={containerStyle}>
      <h1 style={stepTitleStyle}>
        <FormattedMessage id="addBank.step.review.title" />
      </h1>
      <div
        style={{
          backgroundColor: theme.color.surface.raised,
          borderRadius: theme.radius.lg,
          padding: theme.space.lg,
          marginBottom: theme.space.xl,
          color: theme.color.text.primary,
        }}
      >
        <p style={{ margin: 0 }}>
          <FormattedMessage
            id="addBank.review.accounts"
            defaultMessage="Connection successful. 2 accounts linked."
          />
        </p>
      </div>
      <Button
        variant="primary"
        onClick={() => {
          void navigate('/bank-connections');
        }}
      >
        <FormattedMessage id="addBank.review.done" defaultMessage="Done" />
      </Button>
    </div>
  );
}
