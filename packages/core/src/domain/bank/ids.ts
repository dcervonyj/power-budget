import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type BankConnectionId = Brand<string, 'BankConnectionId'>;
export const BankConnectionId = defineId('BankConnectionId');

export type BankAccountId = Brand<string, 'BankAccountId'>;
export const BankAccountId = defineId('BankAccountId');

export type SyncRunId = Brand<string, 'SyncRunId'>;
export const SyncRunId = defineId('SyncRunId');
