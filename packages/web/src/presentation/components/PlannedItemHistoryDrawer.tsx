import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';
import { Drawer } from './Drawer.js';
import { useTheme } from './ThemeContext.js';

export interface PlannedItemHistoryDrawerProps {
  planId: string;
  itemId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  id: string;
  actorName: string;
  changedAt: string; // ISO datetime
  fields: Record<string, { before: unknown; after: unknown }>;
}

// Roll up consecutive same-user edits within 60s
function rollupEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const result: HistoryEntry[] = [];
  for (const entry of entries) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.actorName === entry.actorName &&
      Math.abs(new Date(entry.changedAt).getTime() - new Date(prev.changedAt).getTime()) <= 60_000
    ) {
      // Merge fields: keep latest 'after' values
      result[result.length - 1] = {
        ...prev,
        changedAt: entry.changedAt,
        fields: { ...prev.fields, ...entry.fields },
      };
    } else {
      result.push(entry);
    }
  }
  return result;
}

export function PlannedItemHistoryDrawer({
  planId,
  itemId,
  isOpen,
  onClose,
}: PlannedItemHistoryDrawerProps): React.JSX.Element {
  const intl = useIntl();
  const theme = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) return;
    setLoading(true);
    const fetchHistory = async (): Promise<void> => {
      try {
        const res = await apiClient.get<HistoryEntry[]>(
          `/plans/${planId}/items/${itemId}/history`,
        );
        setEntries(res.data);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };
    void fetchHistory();
  }, [isOpen, loaded, planId, itemId]);

  // Reset when item changes
  useEffect(() => {
    setLoaded(false);
    setEntries([]);
  }, [planId, itemId]);

  const rolledUp = rollupEntries(entries);

  const title = intl.formatMessage({
    id: 'component.historyDrawer.title',
    defaultMessage: 'History',
  });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} width={480}>
      {loading ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.historyDrawer.loading" defaultMessage="Loading…" />
        </p>
      ) : rolledUp.length === 0 ? (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="component.historyDrawer.empty" defaultMessage="No history yet" />
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rolledUp.map((entry) => (
            <li
              key={entry.id}
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
                }}
              >
                <span style={{ color: theme.color.text.primary, fontWeight: 600 }}>
                  <FormattedMessage
                    id="component.historyDrawer.actor"
                    defaultMessage="by {actor}"
                    values={{ actor: entry.actorName }}
                  />
                </span>
                <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
                  {new Date(entry.changedAt).toLocaleString()}
                </span>
              </div>
              <div>
                {Object.entries(entry.fields).map(([field, change]) => (
                  <div
                    key={field}
                    style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}
                  >
                    <strong style={{ color: theme.color.text.primary }}>{field}</strong>:{' '}
                    {String(change.before)} → {String(change.after)}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
