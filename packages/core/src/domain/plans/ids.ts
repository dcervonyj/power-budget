import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type PlanId = Brand<string, 'PlanId'>;
export const PlanId = defineId('PlanId');

export type PlannedItemId = Brand<string, 'PlannedItemId'>;
export const PlannedItemId = defineId('PlannedItemId');

export type PlannedItemVersionId = Brand<string, 'PlannedItemVersionId'>;
export const PlannedItemVersionId = defineId('PlannedItemVersionId');

export type LeftoverSnapshotId = Brand<string, 'LeftoverSnapshotId'>;
export const LeftoverSnapshotId = defineId('LeftoverSnapshotId');
