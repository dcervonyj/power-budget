export type DescriptorClass =
  | 'payu'
  | 'przelewy24'
  | 'allegro'
  | 'blik_p2p'
  | 'blik_merchant'
  | 'atm'
  | 'card'
  | 'transfer'
  | 'fee'
  | 'unclassified';

export interface NormalisedTransaction {
  readonly merchant: string | null;
  readonly merchantKey: string | null;
  readonly counterparty: string | null;
  readonly descriptorClass: DescriptorClass;
  readonly descriptionKey: string;
}

const DIACRITICS: Readonly<Record<string, string>> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

const MERCHANT_PREFIXES: readonly RegExp[] = [
  /^(?:card payment to|card purchase at|platnosc karta|transakcja karta)\s*/i,
  /^(?:payu|przelewy24|p24)\s*[*:-]?\s*/i,
  /^(?:blik(?: payment)?|platnosc blik)\s*[*:-]?\s*/i,
  /^(?:allegro(?:\.pl)?)\s*[*:-]?\s*/i,
  /^(?:wyplata gotowki|cash withdrawal)\s*(?:bankomat|atm)?\s*/i,
  /^(?:oplata|prowizja|fee|charge)\s*[*:-]?\s*/i,
];

/** Folded city names that trail card descriptors. */
const CITIES: readonly string[] = [
  'warszawa',
  'warsaw',
  'krakow',
  'wroclaw',
  'poznan',
  'gdansk',
  'gdynia',
  'sopot',
  'lodz',
  'katowice',
  'szczecin',
  'lublin',
  'bialystok',
  'bydgoszcz',
  'torun',
  'rzeszow',
  'kielce',
  'olsztyn',
  'opole',
  'gliwice',
];

/** Creates a stable, case- and Polish-diacritic-insensitive key. */
export function normaliseText(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .replace(/[ąćęłńóśźż]/g, replacePolishDiacritic)
    .normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1')
    .normalize('NFC')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalises bank-provided transaction text without I/O or provider-specific state.
 * It accepts remittance strings, PKO notification titles, and Wise activity titles.
 */
export function normaliseTransaction(description: string): NormalisedTransaction {
  const descriptorClass = classify(description);
  const counterparty = extractCounterparty(description, descriptorClass);
  const merchant = extractMerchant(description, descriptorClass, counterparty);

  return {
    merchant,
    merchantKey: merchant === null ? null : merchantKey(merchant),
    counterparty,
    descriptorClass,
    descriptionKey: normaliseText(description),
  };
}

function replacePolishDiacritic(character: string): string {
  return DIACRITICS[character] ?? character;
}

function classify(description: string): DescriptorClass {
  const key = normaliseText(description);

  if (/\bpayu\b/.test(key)) {
    return 'payu';
  }

  if (/\b(przelewy24|p24)\b/.test(key)) {
    return 'przelewy24';
  }

  if (/\ballegro\b/.test(key)) {
    return 'allegro';
  }

  if (/\bblik\b/.test(key)) {
    return /\b(telefon|phone|p2p|osoba|person)\b/.test(key) ? 'blik_p2p' : 'blik_merchant';
  }

  if (/\b(bankomat|atm|wyplata gotowki|cash withdrawal)\b/.test(key)) {
    return 'atm';
  }

  if (/\b(oplata|prowizja|fee|charge|commission)\b/.test(key)) {
    return 'fee';
  }

  if (/\b(przelew|transfer|recipient|odbiorca)\b/.test(key)) {
    return 'transfer';
  }

  if (/\b(karta|card payment|card purchase|pos)\b/.test(key)) {
    return 'card';
  }

  return 'unclassified';
}

function extractCounterparty(description: string, descriptorClass: DescriptorClass): string | null {
  if (descriptorClass !== 'transfer' && descriptorClass !== 'blik_p2p') {
    return null;
  }

  const matched = description.match(
    /(?:odbiorca|recipient|beneficiary|transfer to|przelew(?: blik)? do)\s*[:\-]?\s*(.+)$/i,
  );

  if (matched === null || matched[1] === undefined) {
    return null;
  }

  const counterparty = stripTrailingMetadata(matched[1]);

  return counterparty.length === 0 ? null : counterparty;
}

function extractMerchant(
  description: string,
  descriptorClass: DescriptorClass,
  counterparty: string | null,
): string | null {
  if (descriptorClass === 'transfer' || descriptorClass === 'blik_p2p') {
    return counterparty;
  }

  const withoutPrefix = MERCHANT_PREFIXES.reduce(stripPrefix, description);
  const merchant = stripTrailingMetadata(withoutPrefix);

  return merchant.length === 0 ? null : merchant;
}

function stripPrefix(value: string, prefix: RegExp): string {
  return value.replace(prefix, '');
}

function merchantKey(merchant: string): string {
  const withoutNoise = merchant
    .replace(/\b(?:terminal|term|nr|no)\s*[:#]?\s*[a-z0-9-]+\b/gi, '')
    .replace(/\b(?:z|t)\d{3,}\b/gi, '')
    .replace(/\b[ck]\.?\d+\b/gi, '')
    .replace(/\b\d{3,}\b/g, '');

  return stripTrailingLocation(normaliseText(withoutNoise));
}

function stripTrailingLocation(key: string): string {
  const withoutCountry = key.replace(/ (?:pl|pol|polska|poland)$/, '');
  const city = CITIES.find((candidate) => withoutCountry.endsWith(` ${candidate}`));

  return city === undefined ? withoutCountry : withoutCountry.slice(0, -(city.length + 1));
}

function stripTrailingMetadata(value: string): string {
  return value
    .replace(/\b\d{4}[-/.]\d{2}[-/.]\d{2}\b/g, '')
    .replace(/\b\d{2}[-/.]\d{2}[-/.]\d{4}\b/g, '')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
    .replace(/(?:\*{2,}|x{2,}|\.{3})\s?\d{4}\b/gi, '')
    .replace(/\b(?:ref(?:erence)?|id|nr)\s*[:#]?\s*[a-z0-9-]{6,}\b/gi, '')
    .replace(/\b(?:terminal|term)\s*[:#]?\s*[a-z0-9-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
