import { apiClient, settingsStore } from '../../../composition.js';
import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AuditEventDto, AuditPageDto } from '@power-budget/shared-app/contract';
import { AuditLogView } from '../settings/AuditLogView.js';

export const AuditLogScreen = observer(function AuditLogScreen(): React.JSX.Element {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  useEffect(() => {
    // The profile gives the user id that marks the user's own events.
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  const fetchEvents = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get<AuditPageDto>('/audit-log');
      setEvents(res.data.items);
      setNextCursor(res.data.hasMore ? res.data.nextCursor : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (nextCursor === null) {
      return;
    }
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await apiClient.get<AuditPageDto>(
        `/audit-log?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setEvents((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.hasMore ? res.data.nextCursor : null);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return (
    <AuditLogView
      events={events}
      loading={loading}
      error={error}
      hasMore={nextCursor !== null}
      loadingMore={loadingMore}
      loadMoreError={loadMoreError}
      currentUserId={settingsStore.userId}
      onLoadMore={() => {
        void loadMore();
      }}
      onRetry={() => {
        void fetchEvents();
      }}
    />
  );
});
