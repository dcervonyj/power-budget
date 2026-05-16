import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Select } from '../../components/Select.js';
import { Button } from '../../components/Button.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

interface LocalSelectOption {
  value: string;
  label: string;
}

const CURRENCY_LIST: ReadonlyArray<string> = [
  'USD',
  'EUR',
  'GBP',
  'PLN',
  'UAH',
  'CHF',
  'CZK',
  'CAD',
  'AUD',
  'JPY',
];

export const SettingsCurrencyTab = observer(function SettingsCurrencyTab(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [saved, setSaved] = useState(false);

  const currencyOptions: ReadonlyArray<LocalSelectOption> = CURRENCY_LIST.map((c) => ({
    value: c,
    label: c,
  }));

  async function handleSave(): Promise<void> {
    await settingsStore.saveCurrency();
    if (!settingsStore.saveError) {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2500);
    }
  }

  const MAX_INTERESTING = 5;
  const atMax = settingsStore.interestingCurrencies.length >= MAX_INTERESTING;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xl }}>
      {/* Base currency */}
      <div style={{ maxWidth: 300 }}>
        <Select<string>
          id="settings-base-currency"
          label={intl.formatMessage({
            id: 'settings.currency.base',
            defaultMessage: 'Base currency',
          })}
          options={currencyOptions}
          value={settingsStore.baseCurrency}
          onChange={(v) => {
            settingsStore.setBaseCurrency(v);
          }}
        />
      </div>

      {/* Interesting currencies */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
        <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
          <FormattedMessage
            id="settings.currency.interesting"
            defaultMessage="Track additional currencies (max 5)"
          />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.xs }}>
          {CURRENCY_LIST.filter((c) => c !== settingsStore.baseCurrency).map((c) => {
            const isSelected = settingsStore.interestingCurrencies.includes(c);
            const isDisabled = !isSelected && atMax;
            return (
              <button
                key={c}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  settingsStore.toggleInterestingCurrency(c);
                }}
                aria-pressed={isSelected}
                style={{
                  backgroundColor: isSelected
                    ? theme.color.accent.default
                    : theme.color.surface.raised,
                  color: isSelected ? theme.color.accent.onAccent : theme.color.text.primary,
                  border: `1px solid ${
                    isSelected ? theme.color.accent.default : theme.color.border.subtle
                  }`,
                  borderRadius: theme.radius.pill,
                  padding: `${theme.space.xs}px ${theme.space.sm}px`,
                  fontSize: theme.fontSize.sm,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="settings.currency.selectedCount"
            defaultMessage="{count}/{max} selected"
            values={{ count: settingsStore.interestingCurrencies.length, max: MAX_INTERESTING }}
          />
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.md }}>
        <Button
          variant="primary"
          loading={settingsStore.isSaving}
          onClick={() => {
            void handleSave();
          }}
        >
          <FormattedMessage id="settings.currency.save" defaultMessage="Save" />
        </Button>
        {saved && (
          <span style={{ color: theme.color.status.success, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="common.saved" defaultMessage="Saved!" />
          </span>
        )}
      </div>
    </div>
  );
});
