import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type CategoryId = Brand<string, 'CategoryId'>;
// Seeded system categories were created with v4 ids, so any UUID version is valid.
export const CategoryId = defineId('CategoryId', { anyUuidVersion: true });

export type MerchantRuleId = Brand<string, 'MerchantRuleId'>;
export const MerchantRuleId = defineId('MerchantRuleId', { anyUuidVersion: true });

export type CategoryPrivacyId = Brand<string, 'CategoryPrivacyId'>;
export const CategoryPrivacyId = defineId('CategoryPrivacyId');
