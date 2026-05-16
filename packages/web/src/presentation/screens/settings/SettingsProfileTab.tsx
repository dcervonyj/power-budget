import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { Input } from '../../components/Input.js';
import { Button } from '../../components/Button.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export const SettingsProfileTab = observer(function SettingsProfileTab(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [saved, setSaved] = useState(false);

  const initials = getInitials(settingsStore.displayName) || '?';

  async function handleSave(): Promise<void> {
    await settingsStore.saveProfile();
    if (!settingsStore.saveError) {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2500);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xl }}>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.lg }}>
        <div
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: theme.color.accent.default,
            color: theme.color.accent.onAccent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.semibold,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{
              fontSize: theme.fontSize.lg,
              fontWeight: theme.fontWeight.semibold,
              color: theme.color.text.primary,
            }}
          >
            {settingsStore.displayName ||
              intl.formatMessage({
                id: 'settings.profile.displayName',
                defaultMessage: 'Display name',
              })}
          </div>
          {settingsStore.email && (
            <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              {settingsStore.email}
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md, maxWidth: 400 }}>
        <Input
          id="settings-display-name"
          label={intl.formatMessage({
            id: 'settings.profile.displayName',
            defaultMessage: 'Display name',
          })}
          value={settingsStore.displayName}
          onChange={(v) => {
            settingsStore.setDisplayName(v);
          }}
        />

        <Input
          id="settings-email"
          label={intl.formatMessage({
            id: 'settings.profile.email',
            defaultMessage: 'Email',
          })}
          value={settingsStore.email}
          onChange={() => undefined}
          state="disabled"
          type="email"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.md }}>
        <Button
          variant="primary"
          loading={settingsStore.isSaving}
          onClick={() => {
            void handleSave();
          }}
        >
          <FormattedMessage id="settings.profile.save" defaultMessage="Save changes" />
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
