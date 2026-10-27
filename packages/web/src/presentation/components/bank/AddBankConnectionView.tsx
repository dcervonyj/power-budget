import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Icon } from '../../glass/atoms/Icon.js';
import '../../glass/controls/controls.css';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { Button } from '../Button.js';
import { Input } from '../Input.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import type { Bank, Provider, Step } from '../../../application/bank/addBankFlow.js';

export interface AddBankConnectionViewProps {
  readonly step: Step;
  readonly provider: Provider | null;
  readonly banks: readonly Bank[];
  readonly bankSearch: string;
  readonly selectedBank: Bank | null;
  readonly submitting: boolean;
  readonly failed: boolean;
  readonly onProvider: (provider: Provider) => void;
  readonly onSearch: (value: string) => void;
  readonly onBank: (bank: Bank) => void;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onConnect: () => void;
}

const STEP_ORDER: readonly Step[] = ['provider', 'bank', 'scope', 'connect'];

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 640,
  margin: '0 auto',
  padding: 'var(--pb-glass-space-lg)',
  boxSizing: 'border-box',
  color: 'var(--pb-glass-fg)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-title-web)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

const LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const OPTION_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-md)',
  width: '100%',
  minHeight: 44,
  padding: 'var(--pb-glass-space-md) var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-tile)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
};

const OPTION_NAME_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 600,
};

const PANEL_CONTENT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-xl)',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

/** The add-bank flow: provider, bank, what is read, then the redirect to the bank. */
export function AddBankConnectionView(props: AddBankConnectionViewProps): React.JSX.Element {
  const { step } = props;

  return (
    <div style={PAGE_STYLE}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xs)' }}>
        <p style={CAPTION_STYLE}>
          <FormattedMessage
            id="bank.add.progress"
            defaultMessage="Step {current} of {total}"
            values={{ current: STEP_ORDER.indexOf(step) + 1, total: STEP_ORDER.length }}
          />
        </p>
        <h1 style={TITLE_STYLE}>
          <StepTitle step={step} />
        </h1>
      </header>
      <StepBody {...props} />
    </div>
  );
}

function StepTitle({ step }: { step: Step }): React.JSX.Element {
  switch (step) {
    case 'provider':
      return (
        <FormattedMessage id="bank.add.provider.title" defaultMessage="Choose your provider" />
      );
    case 'bank':
      return <FormattedMessage id="bank.add.bank.title" defaultMessage="Pick your bank" />;
    case 'scope':
      return <FormattedMessage id="bank.add.scope.title" defaultMessage="What we will read" />;
    case 'connect':
      return <FormattedMessage id="bank.add.connect.title" defaultMessage="Connect" />;
  }
}

function StepBody(props: AddBankConnectionViewProps): React.JSX.Element {
  switch (props.step) {
    case 'provider':
      return <ProviderStep onProvider={props.onProvider} />;
    case 'bank':
      return <BankStep {...props} />;
    case 'scope':
      return <ScopeStep onBack={props.onBack} onNext={props.onNext} />;
    case 'connect':
      return <ConnectStep {...props} />;
  }
}

function ProviderStep({
  onProvider,
}: {
  onProvider: (provider: Provider) => void;
}): React.JSX.Element {
  return (
    <ul style={LIST_STYLE}>
      <li>
        <button
          type="button"
          className="pbg-ctl"
          style={OPTION_STYLE}
          onClick={() => {
            onProvider('gocardless');
          }}
        >
          <Icon name="bank" size={24} />
          <span>
            <span style={OPTION_NAME_STYLE}>
              <FormattedMessage
                id="bank.add.provider.gocardless.name"
                defaultMessage="GoCardless (PSD2 banks)"
              />
            </span>
            <p style={CAPTION_STYLE}>
              <FormattedMessage
                id="bank.add.provider.gocardless.description"
                defaultMessage="Connect EU banks via Open Banking (PSD2)"
              />
            </p>
          </span>
        </button>
      </li>
      <li>
        <button
          type="button"
          className="pbg-ctl"
          style={OPTION_STYLE}
          onClick={() => {
            onProvider('wise_personal');
          }}
        >
          <Icon name="wallet" size={24} />
          <span>
            <span style={OPTION_NAME_STYLE}>
              <FormattedMessage id="bank.add.provider.wise.name" defaultMessage="Wise" />
            </span>
            <p style={CAPTION_STYLE}>
              <FormattedMessage
                id="bank.add.provider.wise.description"
                defaultMessage="Connect your Wise account directly"
              />
            </p>
          </span>
        </button>
      </li>
    </ul>
  );
}

function BankStep({
  banks,
  bankSearch,
  onSearch,
  onBank,
  onBack,
}: AddBankConnectionViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <>
      <Input
        label={intl.formatMessage({ id: 'bank.add.bank.search', defaultMessage: 'Search banks' })}
        placeholder={intl.formatMessage({
          id: 'bank.add.bank.searchPlaceholder',
          defaultMessage: 'Search banks…',
        })}
        id="bank-search"
        value={bankSearch}
        onChange={onSearch}
      />
      {banks.length === 0 ? (
        <p style={CAPTION_STYLE}>
          <FormattedMessage
            id="bank.add.bank.empty"
            defaultMessage="No banks found. Try a different search."
          />
        </p>
      ) : (
        <ul style={LIST_STYLE}>
          {banks.map((bank) => (
            <li key={bank.id}>
              <button
                type="button"
                className="pbg-ctl"
                style={OPTION_STYLE}
                onClick={() => {
                  onBank(bank);
                }}
              >
                <Icon name="bank" size={24} />
                <span style={OPTION_NAME_STYLE}>{bank.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={ACTIONS_STYLE}>
        <Button variant="secondary" onClick={onBack}>
          <FormattedMessage id="bank.add.back" defaultMessage="Back" />
        </Button>
      </div>
    </>
  );
}

function ScopeStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}): React.JSX.Element {
  return (
    <>
      <GlassPanel
        material="frosted"
        depth={1}
        decor={{ specular: true }}
        contentStyle={PANEL_CONTENT_STYLE}
      >
        <ul style={LIST_STYLE}>
          <ScopeRow>
            <FormattedMessage
              id="bank.add.scope.accounts"
              defaultMessage="Your accounts and balances"
            />
          </ScopeRow>
          <ScopeRow>
            <FormattedMessage
              id="bank.add.scope.transactions"
              defaultMessage="Your transactions, read only"
            />
          </ScopeRow>
          <ScopeRow>
            <FormattedMessage
              id="bank.add.scope.history"
              defaultMessage="Up to the last 90 days of history"
            />
          </ScopeRow>
        </ul>
      </GlassPanel>
      <div style={ACTIONS_STYLE}>
        <Button variant="secondary" onClick={onBack}>
          <FormattedMessage id="bank.add.back" defaultMessage="Back" />
        </Button>
        <Button variant="primary" onClick={onNext}>
          <FormattedMessage id="bank.add.next" defaultMessage="Next" />
        </Button>
      </div>
    </>
  );
}

function ScopeRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-sm)' }}>
      <span style={{ display: 'inline-flex', color: 'var(--pb-glass-ok)' }}>
        <Icon name="check" size={18} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function ConnectStep({
  selectedBank,
  submitting,
  failed,
  onBack,
  onConnect,
}: AddBankConnectionViewProps): React.JSX.Element {
  return (
    <>
      <GlassPanel
        material="frosted"
        depth={1}
        decor={{ specular: true }}
        contentStyle={PANEL_CONTENT_STYLE}
      >
        <p style={CAPTION_STYLE}>
          <FormattedMessage id="bank.add.connect.bank" defaultMessage="Bank" />
        </p>
        <p style={OPTION_NAME_STYLE}>{selectedBank === null ? '' : selectedBank.name}</p>
        <p style={CAPTION_STYLE}>
          <FormattedMessage
            id="bank.add.connect.redirect"
            defaultMessage="You will go to your bank to approve access, then come back here."
          />
        </p>
      </GlassPanel>
      {failed && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="bank.error.connect"
              defaultMessage="Failed to connect. Please try again."
            />
          }
        />
      )}
      <div style={ACTIONS_STYLE}>
        <Button variant="secondary" onClick={onBack}>
          <FormattedMessage id="bank.add.back" defaultMessage="Back" />
        </Button>
        <Button variant="primary" loading={submitting} onClick={onConnect}>
          <FormattedMessage id="bank.add.connect.action" defaultMessage="Continue to your bank" />
        </Button>
      </div>
    </>
  );
}
