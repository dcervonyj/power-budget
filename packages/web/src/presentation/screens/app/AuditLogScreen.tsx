import React, { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AuditEventDto, AuditPageDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../../AppProviders.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';
import { AuditLogView } from '../settings/AuditLogView.js';

export const AuditLogScreen = observer(function AuditLogScreen(): React.JSX.Element {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return (
    <AuditLogView
      events={events}
      loading={loading}
      error={error}
      currentUserId={settingsStore.userId}
      onRetry={() => {
        void fetchEvents();
      }}
    />
  );
});
