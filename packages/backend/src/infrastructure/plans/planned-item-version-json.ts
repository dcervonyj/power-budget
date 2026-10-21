import type { PlannedItemPatch } from '../../domain/plans/entities.js';
import { currencyOf } from '../database/row-values.js';

/** jsonb shape of a planned item version side: bigint minor units as a string. */
export interface PlannedItemPatchJson {
  readonly amount?: { readonly amountMinor: string; readonly currency: string };
  readonly note?: string | null;
}

export function plannedItemPatchToJson(patch: PlannedItemPatch): PlannedItemPatchJson {
  return {
    ...(patch.amount !== undefined
      ? {
          amount: {
            amountMinor: patch.amount.amountMinor.toString(),
            currency: patch.amount.currency,
          },
        }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
  };
}

export function plannedItemPatchFromJson(value: unknown): PlannedItemPatch {
  if (value === null || typeof value !== 'object') {
    return {};
  }
  const json: { amount?: unknown; note?: unknown } = value;
  const amount = parseAmount(json.amount);
  const note = typeof json.note === 'string' || json.note === null ? json.note : undefined;

  return {
    ...(amount !== undefined ? { amount } : {}),
    ...(note !== undefined ? { note } : {}),
  };
}

function parseAmount(value: unknown): PlannedItemPatch['amount'] {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const amount: { amountMinor?: unknown; currency?: unknown } = value;
  if (typeof amount.amountMinor !== 'string' || typeof amount.currency !== 'string') {
    return undefined;
  }

  return { amountMinor: BigInt(amount.amountMinor), currency: currencyOf(amount.currency) };
}
