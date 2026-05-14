import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type TransactionId = Brand<string, 'TransactionId'>;
export const TransactionId = defineId('TransactionId');

export type TransactionMappingId = Brand<string, 'TransactionMappingId'>;
export const TransactionMappingId = defineId('TransactionMappingId');

export type TransferId = Brand<string, 'TransferId'>;
export const TransferId = defineId('TransferId');

export type IngestBatchId = Brand<string, 'IngestBatchId'>;
export const IngestBatchId = defineId('IngestBatchId');
