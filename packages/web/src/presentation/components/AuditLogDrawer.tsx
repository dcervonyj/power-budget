import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';
import { Drawer } from './Drawer.js';
import { useTheme } from './ThemeContext.js';

export interface AuditLogDrawerProps {
  subjectType: string;
  subjectId: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

interface AuditEvent {
  id: string;
  actor: string | null;
  action: string;
  timestamp: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export function AuditLogDrawer({
  subjectType,
  subjectId,
  isOpen,
  onClose,
  title,
}: AuditLogDrawerProps): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) return;
    setLoading(true);
    const fetchEvents = async (): Promise<void> => {
      try {
        const res = await apiClient.get<AuditEvent[]>(
          `/audit-log?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}`,
        );
        const data = res.data;
        setEvents(Array.isArray(data) ? data : []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };
    void fetchEvents();
  }, [isOpen, loaded, subjectType, subjectId]);

  // Reset when subject changes
  useEffect(() => {
    setLoaded(false);
    setEvents([]);
  }, [subjectType, subjectId]);

  const drawerTitle =
    title ??
    intl.formatMessage({
      id: 'component.auditLog.title',
      defaultMessage: 'Audit Log',
    });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={drawerTitle} width={520}>
      {loading ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.auditLog.loading" defaultMessage="Loading…" />
        </p>
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
              <div style={{ color: theme.color.text.primary, fontSize: theme.fontSize.sm }}>
                {event.action}
              </div>
              {(event.before ?? event.after) && (
                <div
                  style={{
                    marginTop: theme.space.xs,
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
    </Drawer>
  );
}
