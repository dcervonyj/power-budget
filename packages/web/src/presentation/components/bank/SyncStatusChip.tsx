import React from 'react';
import { SyncChip, type SyncChipViewer } from '../../glass/atoms/SyncChip.js';
import { deriveSyncChipState } from '../../glass/atoms/syncChipState.js';

export interface SyncStatusChipProps {
  lastSuccessfulAt: Date | null;
  viewer?: SyncChipViewer;
}

/** Caller-facing chip: derives the state from the last successful sync time. */
export function SyncStatusChip({
  lastSuccessfulAt,
  viewer = 'owner',
}: SyncStatusChipProps): React.JSX.Element {
  return <SyncChip state={deriveSyncChipState(lastSuccessfulAt, new Date())} viewer={viewer} />;
}
