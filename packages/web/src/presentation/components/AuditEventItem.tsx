import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { AuditEventDto } from '@power-budget/shared-app/contract';
import { Avatar } from '../glass/atoms/Avatar.js';
import {
  LINE_STYLE,
  ROW_STYLE,
  SMALL_STYLE,
  TEXT_COLUMN_STYLE,
  TITLE_STYLE,
} from '../glass/rows/rowStyles.js';

export interface AuditEventItemProps {
  readonly event: AuditEventDto;
  /** The signed-in user; their own events read "You". */
  readonly currentUserId: string;
}

const ACTOR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-sm)',
};

const META_STYLE: React.CSSProperties = {
  ...SMALL_STYLE,
  margin: 0,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  overflowWrap: 'anywhere',
};

/** One `GET /audit-log` event: who (user id only, no names in the API), when, what. */
export function AuditEventItem({ event, currentUserId }: AuditEventItemProps): React.JSX.Element {
  const intl = useIntl();
  const hasMeta = Object.keys(event.meta).length > 0;
  const isOwn = event.actorId === currentUserId;
  const actor = isOwn
    ? intl.formatMessage({ id: 'component.auditLog.actor.you', defaultMessage: 'You' })
    : intl.formatMessage({
        id: 'component.auditLog.actor.member',
        defaultMessage: 'Household member',
      });

  return (
    <li style={{ ...ROW_STYLE, gap: 'var(--pb-glass-space-xs)' }}>
      <div style={LINE_STYLE}>
        <span style={ACTOR_STYLE}>
          <Avatar person={{ name: actor }} size={32} tone={isOwn ? 'primary' : 'secondary'} />
          <span style={TITLE_STYLE}>{actor}</span>
        </span>
        <time dateTime={event.occurredAt} style={SMALL_STYLE}>
          {intl.formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
        </time>
      </div>
      <div style={{ ...TEXT_COLUMN_STYLE, gap: 'var(--pb-glass-space-xxs)' }}>
        <span>{event.action}</span>
        {hasMeta && (
          <p style={META_STYLE}>
            <FormattedMessage
              id="component.auditLog.details"
              defaultMessage="Details: {value}"
              values={{ value: JSON.stringify(event.meta) }}
            />
          </p>
        )}
      </div>
    </li>
  );
}
