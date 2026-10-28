import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type PlanId = Brand<string, 'PlanId'>;
// The dashboard takes it from a ParseUUIDPipe (any UUID version): a non-v7 id must reach the use case and 404.
export const PlanId = defineId('PlanId', { anyUuidVersion: true });

export type PlannedItemId = Brand<string, 'PlannedItemId'>;
// Ids come from request DTOs validated with IsUUID (any version): a non-v7 id must reach the use case and 404.
export const PlannedItemId = defineId('PlannedItemId', { anyUuidVersion: true });

export type PlannedItemVersionId = Brand<string, 'PlannedItemVersionId'>;
export const PlannedItemVersionId = defineId('PlannedItemVersionId');

export type LeftoverSnapshotId = Brand<string, 'LeftoverSnapshotId'>;
export const LeftoverSnapshotId = defineId('LeftoverSnapshotId');
