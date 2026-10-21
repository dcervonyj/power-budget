import { InvalidIdError } from './errors.js';

export type Brand<T, B extends string> = T & { readonly __brand: B };

const UUIDV7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const ISO_DATETIME_RE =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export type Uuidv7 = Brand<string, 'Uuidv7'>;
export type IsoDate = Brand<string, 'IsoDate'>;
export type IsoDateTime = Brand<string, 'IsoDateTime'>;

export interface IdNamespace<B extends string> {
  readonly brand: B;
  isValid(raw: string): boolean;
  of(raw: string): Brand<string, B>;
}

export interface DefineIdOptions {
  /**
   * Accept any RFC 4122 UUID version instead of only v7. For ids that already
   * exist with another version (seeded system categories use v4).
   */
  readonly anyUuidVersion?: boolean;
}

export const defineId = <B extends string>(
  brand: B,
  options: DefineIdOptions = {},
): IdNamespace<B> => ({
  brand,
  isValid(raw) {
    const pattern = options.anyUuidVersion === true ? ANY_UUID_RE : UUIDV7_RE;

    return typeof raw === 'string' && pattern.test(raw);
  },
  of(raw) {
    if (!this.isValid(raw)) throw new InvalidIdError(brand, raw);
    return raw as Brand<string, B>;
  },
});

export const Uuidv7 = {
  isValid(raw: string): raw is Uuidv7 {
    return UUIDV7_RE.test(raw);
  },
  of(raw: string): Uuidv7 {
    if (!Uuidv7.isValid(raw)) throw new InvalidIdError('Uuidv7', raw);
    return raw;
  },
};

export const IsoDate = {
  isValid(s: string): s is IsoDate {
    return ISO_DATE_RE.test(s);
  },
  of(s: string): IsoDate {
    if (!IsoDate.isValid(s)) throw new InvalidIdError('IsoDate', s);
    return s;
  },
};

export const IsoDateTime = {
  isValid(s: string): s is IsoDateTime {
    return ISO_DATETIME_RE.test(s);
  },
  of(s: string): IsoDateTime {
    if (!IsoDateTime.isValid(s)) throw new InvalidIdError('IsoDateTime', s);
    return s;
  },
};
