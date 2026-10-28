import React from 'react';
import { FormattedMessage } from 'react-intl';
import type { AuditEventDto } from '@power-budget/shared-app/contract';
import { Button } from '../../components/Button.js';
import { AuditEventItem } from '../../components/AuditEventItem.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { HEADER_STYLE, PAGE_STYLE, TITLE_STYLE } from '../app/planStyles.js';

export interface AuditLogViewProps {
  readonly events: readonly AuditEventDto[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  /** Loading a further page failed; the events already shown stay. */
  readonly loadMoreError: boolean;
  readonly onLoadMore: () => void;
  readonly currentUserId: string;
  readonly onRetry: () => void;
}

const LIST_STYLE: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
};

export function AuditLogView({
  events,
  loading,
  error,
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
  currentUserId,
  onRetry,
}: AuditLogViewProps): React.JSX.Element {
  const showEmpty = !loading && !error && events.length === 0;
  const showList = !loading && !error && events.length > 0;

  return (
    <div style={{ ...PAGE_STYLE, maxWidth: 900 }}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="screen.auditLog.title" defaultMessage="Audit Log" />
        </h1>
      </header>

      {loading && <SkeletonList rows={4} rowHeight={72} />}

      {error && !loading && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="screen.auditLog.error"
              defaultMessage="Failed to load the audit log"
            />
          }
          onRetry={onRetry}
        />
      )}

      {showEmpty && (
        <EmptyState
          title={
            <FormattedMessage id="component.auditLog.empty" defaultMessage="No audit events" />
          }
        />
      )}

      {showList && (
        <ul style={LIST_STYLE}>
          {events.map((event) => (
            <AuditEventItem key={event.id} event={event} currentUserId={currentUserId} />
          ))}
        </ul>
      )}

      {showList && loadMoreError && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="screen.auditLog.loadMoreError"
              defaultMessage="Failed to load more events"
            />
          }
          onRetry={onLoadMore}
        />
      )}

      {showList && hasMore && !loadMoreError && (
        <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
          <FormattedMessage id="screen.auditLog.loadMore" defaultMessage="Load more" />
        </Button>
      )}
    </div>
  );
}
