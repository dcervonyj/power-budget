import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { AuditEventDto, AuditPageDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../../AppProviders.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';
import { AuditEventItem } from '../../components/AuditEventItem.js';
import { useTheme } from '../../components/ThemeContext.js';

export const AuditLogScreen = observer(function AuditLogScreen(): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The profile gives the user id that marks the user's own events.
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async (): Promise<void> => {
      try {
        const res = await apiClient.get<AuditPageDto>('/audit-log');
        setEvents(res.data.items);
      } catch {
        setError(
          intl.formatMessage({
            id: 'component.auditLog.empty',
            defaultMessage: 'No audit events',
          }),
        );
      } finally {
        setLoading(false);
      }
    };
    void fetchEvents();
  }, [intl]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: theme.space['2xl'] }}>
      <h1
        style={{
          color: theme.color.text.primary,
          fontSize: theme.fontSize['2xl'],
          marginBottom: theme.space.xl,
        }}
      >
        <FormattedMessage id="screen.auditLog.title" defaultMessage="Audit Log" />
      </h1>

      {loading ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.auditLog.loading" defaultMessage="Loading…" />
        </p>
      ) : error ? (
        <p style={{ color: theme.color.text.secondary }}>{error}</p>
      ) : events.length === 0 ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.auditLog.empty" defaultMessage="No audit events" />
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {events.map((event) => (
            <AuditEventItem key={event.id} event={event} currentUserId={settingsStore.userId} />
          ))}
        </ul>
      )}
    </div>
  );
});
