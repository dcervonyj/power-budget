import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type NotificationEventId = Brand<string, 'NotificationEventId'>;
export const NotificationEventId = defineId('NotificationEventId');

export type ExportId = Brand<string, 'ExportId'>;
export const ExportId = defineId('ExportId');
