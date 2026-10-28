import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type BankConnectionId = Brand<string, 'BankConnectionId'>;
export const BankConnectionId = defineId('BankConnectionId');

export type BankAccountId = Brand<string, 'BankAccountId'>;
// Ids come from request DTOs validated with IsUUID (any version): a non-v7 id must reach the use case and 404.
export const BankAccountId = defineId('BankAccountId', { anyUuidVersion: true });

export type SyncRunId = Brand<string, 'SyncRunId'>;
export const SyncRunId = defineId('SyncRunId');
