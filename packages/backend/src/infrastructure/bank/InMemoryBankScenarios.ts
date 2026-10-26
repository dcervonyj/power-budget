import { IsoDate, bankTxDirectionOf } from '@power-budget/core';
import type { RawTransaction } from '../../domain/bank/entities.js';
import type { InMemoryBankSnapshot } from './InMemoryBankConnector.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A card payment as the bank first reports it: pending on `day1`. */
export interface ScriptedPayment {
  readonly accountExternalId: string;
  /** Day 1: the payment is made and shows as pending. */
  readonly day1: Date;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly counterpartyName: string;
  readonly remittance: string;
}

export interface ScriptedBooking {
  /** The booked amount; it may differ from the pending one (tip, fuel pre-auth, FX). */
  readonly amountMinor: bigint;
  readonly entryReference: string;
  /** Days after day 1 when the bank books it; 2 means day 3. */
  readonly afterDays: number;
}

/**
 * Snapshot scripts for InMemoryBankConnector, matching plan-banking.md §1.7: pending rows carry
 * no entry reference, booked rows do, and the bank's answer replaces the pending row.
 */
export const InMemoryBankScenarios = {
  /** Pending on day 1, then booked (possibly with a changed amount) `afterDays` later. */
  pendingThenBooked(payment: ScriptedPayment, booking: ScriptedBooking): InMemoryBankSnapshot[] {
    const pending = InMemoryBankScenarios.pendingRow(payment);
    const bookedOn = InMemoryBankScenarios.addDays(payment.day1, booking.afterDays);

    return [
      { from: payment.day1, transactions: [pending] },
      {
        from: bookedOn,
        transactions: [
          {
            ...pending,
            status: 'booked',
            entryReference: booking.entryReference,
            bookingDate: IsoDate.of(bookedOn.toISOString().slice(0, 10)),
            amountMinor: booking.amountMinor,
            direction: bankTxDirectionOf(booking.amountMinor),
          },
        ],
      },
    ];
  },

  /** Pending on day 1, then reported cancelled (`CNCL`/`RJCT`) `afterDays` later. */
  pendingThenCancelled(payment: ScriptedPayment, afterDays: number): InMemoryBankSnapshot[] {
    const pending = InMemoryBankScenarios.pendingRow(payment);

    return [
      { from: payment.day1, transactions: [pending] },
      {
        from: InMemoryBankScenarios.addDays(payment.day1, afterDays),
        transactions: [{ ...pending, status: 'cancelled' }],
      },
    ];
  },

  pendingRow(payment: ScriptedPayment): RawTransaction {
    return {
      accountExternalId: payment.accountExternalId,
      status: 'pending',
      entryReference: null,
      bookingDate: null,
      valueDate: null,
      transactionDate: IsoDate.of(payment.day1.toISOString().slice(0, 10)),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      direction: bankTxDirectionOf(payment.amountMinor),
      originalAmount: null,
      counterpartyName: payment.counterpartyName,
      counterpartyIban: null,
      remittance: payment.remittance,
      mcc: null,
      bankTxCode: null,
      balanceAfter: null,
    };
  },

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
  },
};
