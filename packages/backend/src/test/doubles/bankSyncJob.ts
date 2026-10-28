import { Job, type Queue } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import type { BankSyncJobPayload } from '../../infrastructure/bank/BankSyncProcessor.js';

/** A real BullMQ job around `data`, so absent payload fields stay absent (a mock would invent them). */
export function makeBankSyncJob(data: BankSyncJobPayload): Job<BankSyncJobPayload> {
  return new Job<BankSyncJobPayload>(mock<Queue>(), 'bank-sync', data);
}
