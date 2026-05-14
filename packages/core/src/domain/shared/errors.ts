export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: cannot mix ${a} and ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class InvalidIdError extends Error {
  constructor(brand: string, raw: unknown) {
    super(`Invalid ${brand}: ${JSON.stringify(raw)}`);
    this.name = 'InvalidIdError';
  }
}

export class InvalidLocaleError extends Error {
  constructor(raw: unknown) {
    super(`Unsupported locale: ${JSON.stringify(raw)}`);
    this.name = 'InvalidLocaleError';
  }
}
