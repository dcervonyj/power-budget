import { apiClient } from '../../composition.js';
import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { AuditEventDto, AuditPageDto } from '@power-budget/shared-app/contract';
import { AuditEventItem } from './AuditEventItem.js';
import { Drawer } from './Drawer.js';
import { useTheme } from './ThemeContext.js';

export interface AuditLogDrawerProps {
  subjectType: string;
  subjectId: string;
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in user (UserProfileDto.id); their own events read "You". */
  currentUserId: string;
  title?: string;
}

export function AuditLogDrawer({
  subjectType,
  subjectId,
  isOpen,
  onClose,
  currentUserId,
  title,
}: AuditLogDrawerProps): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) {
      return;
    }
    setLoading(true);
    const fetchEvents = async (): Promise<void> => {
      try {
        const res = await apiClient.get<AuditPageDto>(
          `/audit-log?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId)}`,
        );
        setEvents(res.data.items);
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
            <AuditEventItem key={event.id} event={event} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}
