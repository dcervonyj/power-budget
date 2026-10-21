import type { HouseholdId, UserId } from '@power-budget/core';
import type { AuditLogger } from '../../domain/audit/ports.js';
import type { NewAuditEvent } from '../../domain/audit/entities.js';
import type { AuditLogPort } from '../../domain/plans/ports.js';

/** Keys whose numeric value is a money amount in minor units. */
const AMOUNT_KEY = /^(amount|balance)(minor)?$|minor$/i;
/** Keys that hold an account identifier: always masked to the last 4 characters. */
const ACCOUNT_KEY = /^(iban|accountnumber|account_number)$/i;
/** IBAN: country code, check digits, 11 to 30 alphanumerics (total length 15 to 34). */
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const DECIMAL_INTEGER = /^-?\d+$/;

export const REDACTED = Object.freeze({ redacted: true });

export interface RedactionConfig {
  /** Amounts whose absolute value is above this (minor units) are redacted. Default 1_000_000. */
  thresholdMinor: bigint;
}

/**
 * Makes audit metadata safe to store (audit H8/M17):
 * - an amount is redacted only under an amount key (`amount`, `amountMinor`, `balanceMinor`,
 *   any `*Minor`), never just because a number is large (ids, counts, timestamps stay);
 * - IBANs are masked to `***<last 4>` under account keys and inside any string;
 * - bigint values become decimal strings, so the result always fits jsonb.
 */
export class AuditMetaRedactor {
  constructor(private readonly thresholdMinor: bigint) {}

  redact(meta: Record<string, unknown>): Record<string, unknown> {
    return this.redactObject(meta);
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.redactEntry(key, value);
    }

    return result;
  }

  private redactEntry(key: string, value: unknown): unknown {
    if (AMOUNT_KEY.test(key) && this.isAboveThreshold(value)) {
      return REDACTED;
    }
    if (ACCOUNT_KEY.test(key) && typeof value === 'string') {
      return this.maskAccount(value);
    }

    return this.redactValue(value);
  }

  private redactValue(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value.replace(IBAN, this.maskAccount.bind(this));
    }
    if (Array.isArray(value)) {
      return value.map(this.redactValue.bind(this));
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value !== null && typeof value === 'object') {
      return this.redactObject(Object.fromEntries(Object.entries(value)));
    }

    return value;
  }

  private isAboveThreshold(value: unknown): boolean {
    const minor = this.toMinor(value);
    if (minor === null) {
      return false;
    }

    return (minor < 0n ? -minor : minor) > this.thresholdMinor;
  }

  private toMinor(value: unknown): bigint | null {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return BigInt(Math.trunc(value));
    }
    if (typeof value === 'string' && DECIMAL_INTEGER.test(value)) {
      return BigInt(value);
    }

    return null;
  }

  private maskAccount(value: string): string {
    return `***${value.slice(-4)}`;
  }
}

/**
 * The only audit writer the app should inject (REDACTING_AUDIT_LOGGER / AUDIT_LOG_PORT in
 * AuditModule). Serves both the audit-domain AuditLogger and the plans AuditLogPort.
 */
export class RedactingAuditLogger implements AuditLogger, AuditLogPort {
  private readonly redactor: AuditMetaRedactor;

  constructor(
    private readonly inner: AuditLogger,
    config: RedactionConfig = { thresholdMinor: 1_000_000n },
  ) {
    this.redactor = new AuditMetaRedactor(config.thresholdMinor);
  }

  async log(event: NewAuditEvent): Promise<void> {
    await this.inner.log({ ...event, meta: this.redactor.redact(event.meta) });
  }

  async record(event: {
    readonly householdId: HouseholdId;
    readonly actorUserId: UserId;
    readonly action: string;
    readonly subjectType: string;
    readonly subjectId: string;
  }): Promise<void> {
    await this.log({
      householdId: event.householdId,
      actorId: event.actorUserId,
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      meta: {},
    });
  }
}
