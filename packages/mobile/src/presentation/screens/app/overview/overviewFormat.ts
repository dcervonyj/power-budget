import {
  formatMoneyParts,
  type MinorUnitAmount,
  type MoneyPart,
  type SupportedLocale,
} from '@power-budget/core';

/** Same regional formats as core `formatMoney` (English is en-GB: "22 Oct"). */
const LOCALE_BCP47: Readonly<Record<SupportedLocale, string>> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
  ru: 'ru-RU',
};

const FRACTION_PARTS: ReadonlySet<string> = new Set(['decimal', 'fraction']);
const AFFIX_PARTS: ReadonlySet<string> = new Set(['currency', 'literal']);

/**
 * A money amount in whole units ("477", "9 906 zł"): the fraction is dropped, so the amount must
 * already be whole or rounded the way the caller wants (a daily allowance rounds down).
 */
export function formatWholeAmount(
  money: MinorUnitAmount,
  locale: SupportedLocale,
  withCurrency: boolean,
): string {
  return formatMoneyParts(money, locale)
    .filter((part) => keepPart(part, withCurrency))
    .map(partValue)
    .join('')
    .trim();
}

/** An exact money amount with the narrow symbol, as AmountText shows it ("62,50 zł"). */
export function formatExactAmount(money: MinorUnitAmount, locale: SupportedLocale): string {
  return formatMoneyParts(money, locale).map(partValue).join('').trim();
}

/** The currency's narrow symbol in the locale ("zł", "€"), e.g. for "zł a day". */
export function currencySymbol(currency: string, locale: SupportedLocale): string {
  const part = formatMoneyParts({ amountMinor: 0n, currency }, locale).find(isCurrencyPart);

  return part === undefined ? currency : part.value;
}

/** A whole percentage in the locale ("71%", "71 %"). */
export function formatPercent(percent: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / 100,
  );
}

/** An ISO date as day and short month ("31 Oct"); with `weekday`, "Thursday 22 Oct". */
export function formatDayMonth(iso: string, locale: SupportedLocale, weekday: boolean): string {
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    ...(weekday ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function keepPart(part: MoneyPart, withCurrency: boolean): boolean {
  if (FRACTION_PARTS.has(part.type)) {
    return false;
  }

  return withCurrency || !AFFIX_PARTS.has(part.type);
}

function partValue(part: MoneyPart): string {
  return part.value;
}

function isCurrencyPart(part: MoneyPart): boolean {
  return part.type === 'currency';
}
