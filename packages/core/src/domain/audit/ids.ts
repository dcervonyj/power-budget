import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type AuditEventId = Brand<string, 'AuditEventId'>;
export const AuditEventId = defineId('AuditEventId');
