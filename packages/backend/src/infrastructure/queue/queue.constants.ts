export const QUEUE_BANK_SYNC = 'bank-sync';
export const QUEUE_NOTIFICATION_DISPATCH = 'notification-dispatch';
export const QUEUE_OUTBOX_RELAY = 'outbox-relay';
export const QUEUE_PERIOD_CLOSE = 'period-close';
export const QUEUE_ECB_FX = 'ecb-fx';
export const QUEUE_REFRESH_PLAN_ACTUALS = 'refresh-plan-actuals';
export const QUEUE_DLQ = 'dlq';

export const ALL_QUEUES = [
  QUEUE_BANK_SYNC,
  QUEUE_NOTIFICATION_DISPATCH,
  QUEUE_OUTBOX_RELAY,
  QUEUE_PERIOD_CLOSE,
  QUEUE_ECB_FX,
  QUEUE_REFRESH_PLAN_ACTUALS,
] as const;

export type QueueName = (typeof ALL_QUEUES)[number];
