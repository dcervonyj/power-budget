import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../../AppProviders.js';
import { useTheme } from '../../components/ThemeContext.js';

interface AuditEvent {
  id: string;
  actor: string | null;
  action: string;
  timestamp: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export function AuditLogScreen(): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async (): Promise<void> => {
      try {
        const res = await apiClient.get<AuditEvent[]>('/audit-log');
        const data = res.data;
        setEvents(Array.isArray(data) ? data : []);
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
            <li
              key={event.id}
              style={{
                borderBottom: `1px solid ${theme.color.border.subtle}`,
                paddingBottom: theme.space.md,
                marginBottom: theme.space.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: theme.space.xs,
                  flexWrap: 'wrap' as const,
                  gap: theme.space.xs,
                }}
              >
                <span
                  style={{
                    color: theme.color.text.primary,
                    fontWeight: theme.fontWeight.semibold,
                  }}
                >
                  {event.actor ?? (
                    <FormattedMessage
                      id="component.auditLog.actor.system"
                      defaultMessage="System"
                    />
                  )}
                </span>
                <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  color: theme.color.text.primary,
                  marginBottom: event.before ?? event.after ? theme.space.xs : 0,
                }}
              >
                {event.action}
              </div>
              {(event.before ?? event.after) && (
                <div
                  style={{
                    fontSize: theme.fontSize.sm,
                    color: theme.color.text.secondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {event.before && (
                    <div>
                      {intl.formatMessage(
                        { id: 'common.beforeValue', defaultMessage: 'Before: {value}' },
                        { value: JSON.stringify(event.before) },
                      )}
                    </div>
                  )}
                  {event.after && (
                    <div>
                      {intl.formatMessage(
                        { id: 'common.afterValue', defaultMessage: 'After: {value}' },
                        { value: JSON.stringify(event.after) },
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
