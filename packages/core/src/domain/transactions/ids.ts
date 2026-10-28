import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

// Any UUID version: ids are minted as v7, but rows written outside the app (imports, fixtures) may carry v4, and a
// mapping reuses its transaction's id. Repositories brand every row id they read, so they must not reject those.
export type TransactionId = Brand<string, 'TransactionId'>;
export const TransactionId = defineId('TransactionId', { anyUuidVersion: true });

export type TransactionMappingId = Brand<string, 'TransactionMappingId'>;
export const TransactionMappingId = defineId('TransactionMappingId', { anyUuidVersion: true });

export type TransferId = Brand<string, 'TransferId'>;
export const TransferId = defineId('TransferId');

export type IngestBatchId = Brand<string, 'IngestBatchId'>;
export const IngestBatchId = defineId('IngestBatchId');
