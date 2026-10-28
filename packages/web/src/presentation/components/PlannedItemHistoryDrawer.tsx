import { plansApi } from '../../composition.js';
import React, { useEffect, useState } from 'react';
import type { PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import { Drawer } from './Drawer.js';
import { PlannedItemHistoryView } from './PlannedItemHistoryView.js';
import { useIntl } from 'react-intl';

export interface PlannedItemHistoryDrawerProps {
  planId: string;
  itemId: string;
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in user (UserProfileDto.id); their own edits read "by you". */
  currentUserId: string;
}

export function PlannedItemHistoryDrawer({
  planId,
  itemId,
  isOpen,
  onClose,
  currentUserId,
}: PlannedItemHistoryDrawerProps): React.JSX.Element {
  const intl = useIntl();
  const [versions, setVersions] = useState<PlannedItemVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || loaded) {
      return;
    }
    setLoading(true);
    setFailed(false);
    const fetchHistory = async (): Promise<void> => {
      try {
        setVersions(await plansApi.itemHistory(planId, itemId));
      } catch {
        setVersions([]);
        setFailed(true);
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
    setVersions([]);
  }, [planId, itemId]);

  const title = intl.formatMessage({
    id: 'component.historyDrawer.title',
    defaultMessage: 'History',
  });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} width={480}>
      <PlannedItemHistoryView
        versions={versions}
        loading={loading}
        failed={failed}
        currentUserId={currentUserId}
      />
    </Drawer>
  );
}
