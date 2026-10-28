import { settingsStore } from '../../../composition.js';
import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Avatar } from '../../glass/atoms/Avatar.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import {
  ACTIONS_STYLE,
  ERROR_STYLE,
  FIELDS_STYLE,
  HEADING_STYLE,
  NOTE_STYLE,
  SECTION_STYLE,
  SUCCESS_STYLE,
} from './settingsStyles.js';
import { Input } from '../../components/Input.js';
import { Button } from '../../components/Button.js';

export const SettingsProfileTab = observer(function SettingsProfileTab(): React.JSX.Element {
  const intl = useIntl();
  const [saved, setSaved] = useState(false);

  const displayName = settingsStore.displayName;

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
    <GlassPanel material="frosted" depth={1} contentStyle={SECTION_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-lg)' }}>
        <Avatar person={{ name: displayName }} size={64} />
        <div>
          <h2 style={HEADING_STYLE}>
            {displayName ||
              intl.formatMessage({
                id: 'settings.profile.displayName',
                defaultMessage: 'Display name',
              })}
          </h2>
          {settingsStore.email && <p style={NOTE_STYLE}>{settingsStore.email}</p>}
        </div>
      </div>

      <div style={FIELDS_STYLE}>
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

        <Input
          id="settings-timezone"
          label={intl.formatMessage({
            id: 'settings.profile.timezone',
            defaultMessage: 'Time zone',
          })}
          placeholder={intl.formatMessage({
            id: 'settings.profile.timezonePlaceholder',
            defaultMessage: 'e.g. Europe/Warsaw',
          })}
          value={settingsStore.timezone}
          onChange={(v) => {
            settingsStore.setTimezone(v);
          }}
        />
      </div>

      <div style={ACTIONS_STYLE}>
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
