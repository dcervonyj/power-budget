import { normaliseTransaction, type DescriptorClass } from '@power-budget/core';
import type { MerchantRuleKey } from './entities.js';

export interface MerchantRuleSource {
  readonly counterpartyIbanHash: string | null;
  readonly counterpartyName: string | null;
  readonly merchant: string | null;
  readonly description: string;
}

/**
 * The keys a transaction can be recognised by, strongest first: the counterparty IBAN hash,
 * then the merchant keys of AI-001 `normaliseTransaction()` for the bank's counterparty name,
 * the stored merchant and the description. Learning and matching use the same list.
 */
export function merchantRuleKeysOf(source: MerchantRuleSource): MerchantRuleKey[] {
  const keys: MerchantRuleKey[] = [];
  if (source.counterpartyIbanHash !== null && source.counterpartyIbanHash !== '') {
    keys.push({ matchKind: 'counterparty_iban_hash', pattern: source.counterpartyIbanHash });
  }

  const texts: Array<{ text: string | null; isDescription: boolean }> = [
    { text: source.counterpartyName, isDescription: false },
    { text: source.merchant, isDescription: false },
    { text: source.description, isDescription: true },
  ];
  for (const { text, isDescription } of texts) {
    const key = text === null ? null : merchantKeyOf(text, isDescription);
    if (key !== null && !keys.some((existing) => existing.pattern === key)) {
      keys.push({ matchKind: 'merchant', pattern: key });
    }
  }

  return keys;
}

/** Confidence of a merchant-rule suggestion: 0.80 for one confirmation, up to 0.95 for four. */
export function merchantRuleConfidence(hits: number): number {
  const thousandths = Math.min(950, 800 + 50 * Math.max(0, hits - 1));

  return thousandths / 1000;
}

/** Descriptor classes whose free text names no merchant ("Faktura 1/2026", "Zwrot"). */
const GENERIC_DESCRIPTOR_CLASSES: readonly DescriptorClass[] = [
  'unclassified',
  'transfer',
  'fee',
  'atm',
];

function merchantKeyOf(text: string, isDescription: boolean): string | null {
  const normalised = normaliseTransaction(text);
  if (normalised.merchantKey === null || normalised.merchantKey === '') {
    return null;
  }
  if (isDescription && GENERIC_DESCRIPTOR_CLASSES.includes(normalised.descriptorClass)) {
    return null;
  }

  return normalised.merchantKey;
}
