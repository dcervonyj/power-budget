import { settingsStore } from '../../../composition.js';
import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { CURRENCIES } from '@power-budget/core';
import { Select } from '../../components/Select.js';
import { Button } from '../../components/Button.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import '../../glass/controls/controls.css';
import {
  ACTIONS_STYLE,
  ERROR_STYLE,
  NOTE_STYLE,
  SECTION_STYLE,
  SUCCESS_STYLE,
  chipStyle,
} from './settingsStyles.js';

interface LocalSelectOption {
  value: string;
  label: string;
}

/** Base currencies the API accepts (UpdateUserProfileDto.baseCurrency). */
const BASE_CURRENCY_LIST: ReadonlyArray<string> = Object.keys(CURRENCIES);

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
  const intl = useIntl();
  const [saved, setSaved] = useState(false);

  const currencyOptions: ReadonlyArray<LocalSelectOption> = BASE_CURRENCY_LIST.map((c) => ({
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
    <GlassPanel material="frosted" depth={1} contentStyle={SECTION_STYLE}>
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

      <div
        role="group"
        aria-labelledby="settings-interesting-label"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}
      >
        <span id="settings-interesting-label" style={NOTE_STYLE}>
          <FormattedMessage
            id="settings.currency.interesting"
            defaultMessage="Track additional currencies (max 5)"
          />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pb-glass-space-xs)' }}>
          {CURRENCY_LIST.filter((c) => c !== settingsStore.baseCurrency).map((c) => {
            const isSelected = settingsStore.interestingCurrencies.includes(c);

            return (
              <button
                key={c}
                type="button"
                className="pbg-ctl"
                disabled={!isSelected && atMax}
                onClick={() => {
                  settingsStore.toggleInterestingCurrency(c);
                }}
                aria-pressed={isSelected}
                style={chipStyle(isSelected)}
              >
                {c}
              </button>
            );
          })}
        </div>
        <span style={NOTE_STYLE}>
          <FormattedMessage
            id="settings.currency.selectedCount"
            defaultMessage="{count}/{max} selected"
            values={{ count: settingsStore.interestingCurrencies.length, max: MAX_INTERESTING }}
          />
        </span>
      </div>

      <div style={ACTIONS_STYLE}>
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
          <span role="status" style={SUCCESS_STYLE}>
            <FormattedMessage id="common.saved" defaultMessage="Saved!" />
          </span>
        )}
        {settingsStore.saveError !== null && (
          <span role="alert" style={ERROR_STYLE}>
            <FormattedMessage
              id="settings.saveError"
              defaultMessage="Could not save. Please try again."
            />
          </span>
        )}
      </div>
    </GlassPanel>
  );
});
