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
  ß: 'ss',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  đ: 'd',
  ð: 'd',
  þ: 'th',
};

/** Keyword end: next char is not a letter or digit (JS \b is ASCII-only). */
const END = String.raw`(?![\p{L}\d])`;

// Wise: "Card transaction of 12.34 PLN issued by Biedronka", "1,234.56" and "1 234,56" amounts.
const WISE_CARD_PREFIX = toPrefixPattern(
  `card transaction of\\s+[-+]?\\d[\\d\\s.,'\u2019]*?\\s*\\p{L}{3}\\s+issued by${END}\\s*`,
);

const MERCHANT_PREFIXES: readonly RegExp[] = [
  `(?:card payment to|card purchase at|p[łl]atno[śs][ćc] kart[ąa]|transakcja kart[ąa])${END}[\\s*:-]*`,
  `(?:payu|przelewy24|p24)${END}[\\s*:-]*`,
  `(?:blik payment|p[łl]atno[śs][ćc] blik|blik)${END}[\\s*:-]*`,
  `(?:allegro\\.pl|allegro)${END}[\\s*:-]*`,
  `(?:wyp[łl]ata got[óo]wki|cash withdrawal)${END}(?:\\s+(?:bankomat|atm)${END})?\\s*`,
  `(?:op[łl]ata|prowizja|fee|charge)${END}[\\s*:-]*`,
].map(toPrefixPattern);

function toPrefixPattern(source: string): RegExp {
  return new RegExp(`^${source}`, 'iu');
}

const COUNTERPARTY_MARKER =
  /\b(?:odbiorca|nadawca|recipient|sender|beneficiary|transfer (?:to|from)|received from|sent to|przelew(?: blik)? (?:do|od)|(?:przelew )?(?:blik )?na telefon)\b/i;

const TITLE_MARKER = /,|(?<![\p{L}\d])(?:op[łl]ata za|tytu[łl](?:em)?|title|za)(?![\p{L}\d])/iu;

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
    .replace(/[ąćęłńóśźżßøæœđðþ]/g, replacePolishDiacritic)
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
export function normaliseTransaction(rawDescription: string): NormalisedTransaction {
  const description = collapseWhitespace(rawDescription);
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

function collapseWhitespace(value: string): string {
  return value.split(/\s+/).filter(isNotEmpty).join(' ');
}

function isNotEmpty(value: string): boolean {
  return value.length > 0;
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

  if (
    /\b(przelew (do|od)|odbiorca|nadawca|transfer (to|from)|received from|sent to|beneficiary|recipient|sender)\b/.test(
      key,
    )
  ) {
    return 'transfer';
  }

  if (/\b(oplata|prowizja|fee|charge|commission)\b/.test(key)) {
    return 'fee';
  }

  if (/\b(przelew|transfer)\b/.test(key)) {
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

  const matched = COUNTERPARTY_MARKER.exec(description);

  if (matched === null) {
    return null;
  }

  const rest = description.slice(matched.index + matched[0].length).replace(/^[\s:-]+/, '');
  const counterparty = stripTrailingMetadata(cutAtTitle(rest));

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

  const merchant = stripTrailingMetadata(stripFirstPrefix(description));

  return merchant.length === 0 ? null : merchant;
}

function cutAtTitle(rest: string): string {
  const markerAt = rest.search(TITLE_MARKER);
  const name = (markerAt === -1 ? rest : rest.slice(0, markerAt)).trim();

  return name.length === 0 ? rest : name;
}

function stripFirstPrefix(description: string): string {
  // The Wise wrapper hides the real descriptor: "... issued by PayU Biedronka" strips like "PayU Biedronka".
  if (WISE_CARD_PREFIX.test(description)) {
    // Never fall back to the full title: it carries the amount, so every purchase would key differently.
    return stripFirstPrefix(description.replace(WISE_CARD_PREFIX, ''));
  }

  for (const prefix of MERCHANT_PREFIXES) {
    if (prefix.test(description)) {
      return keepPrefixWhenNothingFollows(description, description.replace(prefix, ''));
    }
  }

  return description;
}

/** "Allegro", "PAYU 98765 WARSZAWA": the processor is the merchant when only noise follows. */
function keepPrefixWhenNothingFollows(description: string, rest: string): string {
  const key = merchantKey(stripTrailingMetadata(rest));

  return key === '' || CITIES.includes(key) ? description : rest;
}

function merchantKey(merchant: string): string {
  const withoutNoise = merchant
    .replace(/\b(?:terminal|term|nr|no)\b[\s:.#]*\d[\w-]*/gi, '')
    .replace(/\b(?:z|t)\d{3,}\b/gi, '')
    .replace(/\b[ck]\.?\d+\b/gi, '')
    .replace(/\b\d{3,}\b/g, '');

  return stripTrailingLocation(normaliseText(withoutNoise.replace(/\.pl\b/gi, '')));
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
    .replace(/\b(?:ref(?:erence)?|id|nr)\b[\s:#]*(?=[a-z0-9-]{0,63}\d)[a-z0-9-]{6,64}/gi, '')
    .replace(/\b(?:terminal|term)\b[\s:#]*\d[\w-]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
