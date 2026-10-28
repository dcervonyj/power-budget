import { normaliseTransaction } from '@power-budget/core';
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

  const named = nonEmpty(source.counterpartyName) || nonEmpty(source.merchant);
  const texts: Array<{ text: string | null; isDescription: boolean }> = [
    { text: source.counterpartyName, isDescription: false },
    { text: source.merchant, isDescription: false },
    // Bank boilerplate is shared by many merchants: the description is a key only for rows
    // that carry no counterparty name or merchant of their own.
    { text: named ? null : source.description, isDescription: true },
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

/** merchant_rules.pattern is varchar(255); a longer key is free text, not a merchant. */
const MAX_PATTERN_LENGTH = 255;

/** Titles that name a kind of payment, not a merchant ("Faktura 1/2026", "Zwrot"). */
const GENERIC_TITLE_WORDS: readonly string[] = [
  'faktura',
  'fv',
  'zwrot',
  'przelew',
  'oplata',
  'platnosc',
  'wplata',
  'wyplata',
  'rachunek',
  'splata',
  'transfer',
  'payment',
  'refund',
  'invoice',
];

/** Leading bank boilerplate ("Zakup przy uzyciu karty", "Zakup BLIK"), stripped before the merchant. */
const BOILERPLATE_WORDS: readonly string[] = [
  'zakup',
  'transakcja',
  'przy',
  'uzyciu',
  'karta',
  'karty',
  'kartowa',
  'blik',
];

function stripBoilerplate(key: string): string {
  const words = key.split(' ');
  const firstMerchantWord = words.findIndex((word) => !BOILERPLATE_WORDS.includes(word));

  return firstMerchantWord === -1 ? '' : words.slice(firstMerchantWord).join(' ');
}

function merchantKeyOf(text: string, isDescription: boolean): string | null {
  const normalised = normaliseTransaction(text);
  const key = normalised.merchantKey;
  if (key === null || key === '' || key.length > MAX_PATTERN_LENGTH) {
    return null;
  }
  // A merchant named in a Wise card wrapper is a known merchant, not generic bank boilerplate.
  if (!isDescription || normalised.isWiseCard) {
    return key;
  }
  if (normalised.descriptorClass === 'fee' || normalised.descriptorClass === 'atm') {
    return null;
  }
  if (normalised.descriptorClass === 'transfer' && normalised.counterparty === null) {
    return null;
  }
  const stripped = stripBoilerplate(key);
  if (stripped === '' || GENERIC_TITLE_WORDS.includes(firstWord(stripped))) {
    return null;
  }

  return stripped;
}

function nonEmpty(value: string | null): boolean {
  return value !== null && value.trim() !== '';
}

function firstWord(text: string): string {
  const space = text.indexOf(' ');

  return space === -1 ? text : text.slice(0, space);
}
