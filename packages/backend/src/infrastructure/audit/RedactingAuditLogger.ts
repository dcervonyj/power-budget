import type { AuditLogger } from '../../domain/audit/ports.js';
import type { NewAuditEvent } from '../../domain/audit/entities.js';

// IBAN patterns: PL (26 digits), GB (2 letters + 4 letters + 14 digits), generic IBAN
const IBAN_PATTERNS = [
  /\bPL\d{26}\b/g,
  /\bGB\d{2}[A-Z]{4}\d{14}\b/g,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g, // generic IBAN (loose)
];

const LAST_FOUR_RE = /(.{4})$/;

function redactIban(value: string): string {
  const last4 = LAST_FOUR_RE.exec(value)?.[1] ?? '????';

  return `***${last4}`;
}

function isIban(value: string): boolean {
  return IBAN_PATTERNS.some((re) => {
    re.lastIndex = 0;

    return re.test(value);
  });
}

function redactValue(value: unknown, thresholdMinor: bigint): unknown {
  if (typeof value === 'string' && isIban(value)) {
    return redactIban(value);
  }

  if (typeof value === 'bigint' && value > thresholdMinor) {
    return { redacted: true };
  }

  if (typeof value === 'number' && BigInt(Math.round(value)) > thresholdMinor) {
    return { redacted: true };
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return redactObject(value as Record<string, unknown>, thresholdMinor);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, thresholdMinor));
  }

  return value;
}

function redactObject(
  obj: Record<string, unknown>,
  thresholdMinor: bigint,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (
      (key === 'amountMinor' || key === 'amount') &&
      (typeof val === 'bigint' || typeof val === 'number')
    ) {
      result[key] = redactValue(val, thresholdMinor);
    } else {
      result[key] = redactValue(val, thresholdMinor);
    }
  }

  return result;
}

export interface RedactionConfig {
  /** Amounts above this threshold (in minor units) are redacted. Default: 1_000_000 (= 10,000 in major). */
  thresholdMinor: bigint;
}

export class RedactingAuditLogger implements AuditLogger {
  private readonly thresholdMinor: bigint;

  constructor(
    private readonly inner: AuditLogger,
    config: RedactionConfig = { thresholdMinor: 1_000_000n },
  ) {
    this.thresholdMinor = config.thresholdMinor;
  }

  async log(event: NewAuditEvent): Promise<void> {
    const redactedMeta = redactObject(event.meta, this.thresholdMinor);
    await this.inner.log({ ...event, meta: redactedMeta });
  }
}
