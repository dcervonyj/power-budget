import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type NotificationEventId = Brand<string, 'NotificationEventId'>;
// Outbox rows may predate uuidv7 ids; the worker must still process them.
export const NotificationEventId = defineId('NotificationEventId', { anyUuidVersion: true });

export type ExportId = Brand<string, 'ExportId'>;
export const ExportId = defineId('ExportId');
