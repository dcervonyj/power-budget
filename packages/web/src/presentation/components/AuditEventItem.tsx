import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { AuditEventDto } from '@power-budget/shared-app/contract';
import { useTheme } from './ThemeContext.js';

export interface AuditEventItemProps {
  readonly event: AuditEventDto;
  /** The signed-in user; their own events read "You". */
  readonly currentUserId: string;
}

/** One `GET /audit-log` event: who (user id only, no names in the API), when, what. */
export function AuditEventItem({ event, currentUserId }: AuditEventItemProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const hasMeta = Object.keys(event.meta).length > 0;

  return (
    <li
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
          flexWrap: 'wrap',
          gap: theme.space.xs,
        }}
      >
        <span style={{ color: theme.color.text.primary, fontWeight: theme.fontWeight.semibold }}>
          {event.actorId === currentUserId ? (
            <FormattedMessage id="component.auditLog.actor.you" defaultMessage="You" />
          ) : (
            <FormattedMessage
              id="component.auditLog.actor.member"
              defaultMessage="Household member"
            />
          )}
        </span>
        <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
          {intl.formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      <div style={{ color: theme.color.text.primary, marginBottom: hasMeta ? theme.space.xs : 0 }}>
        {event.action}
      </div>
      {hasMeta && (
        <div
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.text.secondary,
            fontFamily: 'monospace',
          }}
        >
          {intl.formatMessage(
            { id: 'component.auditLog.details', defaultMessage: 'Details: {value}' },
            { value: JSON.stringify(event.meta) },
          )}
        </div>
      )}
    </li>
  );
}
