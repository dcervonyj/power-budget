import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type FxRateId = Brand<string, 'FxRateId'>;
export const FxRateId = defineId('FxRateId');
