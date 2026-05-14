import type { Brand } from '../shared/ids.js';
import { defineId } from '../shared/ids.js';

export type CategoryId = Brand<string, 'CategoryId'>;
export const CategoryId = defineId('CategoryId');

export type CategoryPrivacyId = Brand<string, 'CategoryPrivacyId'>;
export const CategoryPrivacyId = defineId('CategoryPrivacyId');
