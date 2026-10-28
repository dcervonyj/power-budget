import type { PlannedItemPatch } from '../../domain/plans/entities.js';
import { currencyOf } from '../database/row-values.js';
import { matchHintFromJson, matchHintToJson, type MatchHintJson } from './match-hint-json.js';

/** jsonb shape of a planned item version side: bigint minor units as a string. */
export interface PlannedItemPatchJson {
  readonly amount?: { readonly amountMinor: string; readonly currency: string };
  readonly note?: string | null;
  readonly matchHint?: MatchHintJson | null;
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
    ...(patch.matchHint !== undefined ? { matchHint: matchHintToJson(patch.matchHint) } : {}),
  };
}

export function plannedItemPatchFromJson(value: unknown): PlannedItemPatch {
  if (value === null || typeof value !== 'object') {
    return {};
  }
  const json: { amount?: unknown; note?: unknown; matchHint?: unknown } = value;
  const amount = parseAmount(json.amount);
  const note = typeof json.note === 'string' || json.note === null ? json.note : undefined;

  return {
    ...(amount !== undefined ? { amount } : {}),
    ...(note !== undefined ? { note } : {}),
    ...('matchHint' in json ? { matchHint: matchHintFromJson(json.matchHint) } : {}),
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
