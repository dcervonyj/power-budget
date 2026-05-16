import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

export const SettingsNotificationsTab = observer(
  function SettingsNotificationsTab(): React.JSX.Element {
    const theme = useTheme();
    const intl = useIntl();
    const [saved, setSaved] = useState(false);

    async function handleSave(): Promise<void> {
      await settingsStore.saveNotifications();
      if (!settingsStore.saveError) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
        }, 2500);
      }
    }

    const thresholdLabel = intl.formatMessage(
      { id: 'settings.notifications.overBudgetValue', defaultMessage: '{value}% of budget' },
      { value: settingsStore.overBudgetThreshold },
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xl, maxWidth: 480 }}>
        {/* Weekly digest toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space.lg,
          }}
        >
          <div>
            <div
              style={{
                fontSize: theme.fontSize.md,
                fontWeight: theme.fontWeight.medium,
                color: theme.color.text.primary,
              }}
            >
              <FormattedMessage
                id="settings.notifications.weeklyDigest"
                defaultMessage="Weekly budget digest"
              />
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              <FormattedMessage
                id="settings.notifications.weeklyDigest.description"
                defaultMessage="Receive a weekly summary of your budget activity."
              />
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settingsStore.weeklyDigest}
            onClick={() => {
              settingsStore.setWeeklyDigest(!settingsStore.weeklyDigest);
            }}
            style={{
              width: 44,
              height: 24,
              borderRadius: theme.radius.pill,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: settingsStore.weeklyDigest
                ? theme.color.accent.default
                : theme.color.border.strong,
              position: 'relative',
              flexShrink: 0,
              transition: 'background-color 0.2s',
            }}
            aria-label={intl.formatMessage({
              id: 'settings.notifications.weeklyDigest',
              defaultMessage: 'Weekly budget digest',
            })}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: settingsStore.weeklyDigest ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: 'white',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>

        {/* Over-budget threshold slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <label
              htmlFor="settings-over-budget-threshold"
              style={{
                fontSize: theme.fontSize.md,
                fontWeight: theme.fontWeight.medium,
                color: theme.color.text.primary,
              }}
            >
              <FormattedMessage
                id="settings.notifications.overBudget"
                defaultMessage="Over-budget alert threshold"
              />
            </label>
            <span
              style={{
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.semibold,
                color: theme.color.accent.default,
              }}
            >
              {thresholdLabel}
            </span>
          </div>
          <input
            id="settings-over-budget-threshold"
            type="range"
            min={50}
            max={100}
            step={5}
            value={settingsStore.overBudgetThreshold}
            onChange={(e) => {
              settingsStore.setOverBudgetThreshold(Number(e.target.value));
            }}
            style={{ width: '100%', accentColor: theme.color.accent.default }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: theme.fontSize.xs,
              color: theme.color.text.secondary,
            }}
          >
            <span>
              <FormattedMessage
                id="settings.notifications.thresholdMinLabel"
                defaultMessage="50%"
              />
            </span>
            <span>
              <FormattedMessage
                id="settings.notifications.thresholdMaxLabel"
                defaultMessage="100%"
              />
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.md }}>
          <Button
            variant="primary"
            loading={settingsStore.isSaving}
            onClick={() => {
              void handleSave();
            }}
          >
            <FormattedMessage id="settings.notifications.save" defaultMessage="Save" />
          </Button>
          {saved && (
            <span style={{ color: theme.color.status.success, fontSize: theme.fontSize.sm }}>
              <FormattedMessage id="common.saved" defaultMessage="Saved!" />
            </span>
          )}
        </div>
      </div>
    );
  },
);
