export const QUEUE_BANK_SYNC = 'bank-sync';
export const QUEUE_NOTIFICATION_DISPATCH = 'notification-dispatch';
export const QUEUE_PERIOD_CLOSE = 'period-close';
export const QUEUE_ECB_FX = 'ecb-fx';
/**
 * Reserved name for the GDPR household export queue. NOT in ALL_QUEUES and nothing enqueues
 * to it: no processor exists yet (CLN-056, decision D6), so a job would sit in the 25 MB
 * noeviction Redis forever. Register it in ALL_QUEUES together with its processor.
 */
export const QUEUE_HOUSEHOLD_EXPORT = 'household-export';
export const QUEUE_DLQ = 'dlq';

export const ALL_QUEUES = [
  QUEUE_BANK_SYNC,
  QUEUE_NOTIFICATION_DISPATCH,
  QUEUE_PERIOD_CLOSE,
  QUEUE_ECB_FX,
] as const;

export type QueueName = (typeof ALL_QUEUES)[number];

/**
 * Idle workers wake up every drainDelay seconds (BullMQ default 5) to poll for work. 30 s
 * cuts idle Redis commands about 6x; new jobs still wake a blocked worker at once, only
 * the timeout of the blocking call changes.
 */
export const WORKER_DRAIN_DELAY_SECONDS = 30;
