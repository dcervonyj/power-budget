import { useCallback, useMemo, useRef, useState } from 'react';
import type { TransactionListRow } from '../../../../infrastructure/transactions/TransactionListModel.js';
import { choicesFor, impactOf, withSorted } from './categorizeModel.js';
import type { CategoryChoice, Impact, Payment } from './categorizeModel.js';

/** `saving`: a Confirm is on its way. `done`: the server has the mapping. `undoing`: an Undo is on its way. */
export type PaymentPhase = 'choosing' | 'saving' | 'done' | 'undoing';
export type SessionFailure = 'confirm' | 'undo';

export interface CategorizeSessionInput {
  /** The payments to sort, fixed when the sheet opens. */
  readonly queue: readonly TransactionListRow[];
  readonly startIndex: number;
  readonly choices: readonly CategoryChoice[];
  /** Writes the mapping (null clears it); resolves once the server has it. */
  readonly write: (transactionId: string, plannedItemId: string | null) => Promise<void>;
  /** Ids whose write is on its way; shared with the container so a reopened sheet skips them. */
  readonly busyIds: Set<string>;
  readonly onConfirmed: (transactionId: string) => void;
  readonly onUndone: (transactionId: string) => void;
}

export interface CategorizeSession {
  /** Position of the payment shown, 1-based; the total is the queue length. */
  readonly position: number;
  readonly total: number;
  readonly allDone: boolean;
  readonly sortedCount: number;
  readonly row: TransactionListRow | undefined;
  readonly options: readonly CategoryChoice[];
  readonly picked: CategoryChoice | undefined;
  readonly impact: Impact | undefined;
  readonly phase: PaymentPhase;
  readonly failure: SessionFailure | null;
  /** Name of the payment after this one; undefined for the last. */
  readonly nextTitle: string | undefined;
  readonly pick: (plannedItemId: string) => void;
  readonly confirm: () => void;
  readonly undo: () => void;
  readonly next: () => void;
  readonly dismissFailure: () => void;
}

/**
 * The state of one pass over the unsorted payments. A payment is `done` only when the server has
 * the mapping, and while a write is on its way the payment accepts no second Confirm, Undo or
 * Next, so a double tap or a Confirm followed by Undo cannot race.
 */
export function useCategorizeSession(input: CategorizeSessionInput): CategorizeSession {
  const [index, setIndex] = useState(input.startIndex);
  const [picks, setPicks] = useState<ReadonlyMap<string, string>>(new Map());
  const [phases, setPhases] = useState<ReadonlyMap<string, PaymentPhase>>(new Map());
  const [failure, setFailure] = useState<SessionFailure | null>(null);
  const latest = useRef(input);
  latest.current = input;

  const row = input.queue[index];
  const payment = row === undefined ? undefined : paymentOf(row);
  const phase: PaymentPhase =
    (row === undefined ? undefined : phases.get(row.data.id)) ?? 'choosing';
  const sortedPayments = useMemo(() => donePayments(input.queue, phases), [input.queue, phases]);
  const options = useMemo(
    () =>
      payment === undefined
        ? []
        : choicesFor(withSorted(input.choices, sortedPayments, picks, payment.id), payment),
    [input.choices, sortedPayments, picks, payment],
  );
  const pickedId =
    payment === undefined ? undefined : (picks.get(payment.id) ?? payment.suggestedPlannedItemId);
  const picked = options.find((option) => option.plannedItemId === pickedId);
  const impact =
    picked === undefined || payment === undefined ? undefined : impactOf(picked, payment);

  const setPhase = useCallback((id: string, next: PaymentPhase): void => {
    setPhases((previous) => new Map(previous).set(id, next));
  }, []);

  const pick = useCallback(
    (plannedItemId: string): void => {
      if (payment === undefined || phase !== 'choosing') {
        return;
      }
      setPicks((previous) => new Map(previous).set(payment.id, plannedItemId));
    },
    [payment, phase],
  );

  const confirm = useCallback((): void => {
    if (payment === undefined || picked === undefined || phase !== 'choosing') {
      return;
    }
    const { id } = payment;
    const target = picked.plannedItemId;
    if (latest.current.busyIds.has(id)) {
      return;
    }
    latest.current.busyIds.add(id);
    setFailure(null);
    setPicks((previous) => new Map(previous).set(id, target));
    setPhase(id, 'saving');
    latest.current.write(id, target).then(
      () => {
        latest.current.busyIds.delete(id);
        setPhase(id, 'done');
        latest.current.onConfirmed(id);
      },
      () => {
        latest.current.busyIds.delete(id);
        setPhase(id, 'choosing');
        setFailure('confirm');
      },
    );
  }, [payment, picked, phase, setPhase]);

  const undo = useCallback((): void => {
    if (payment === undefined || phase !== 'done') {
      return;
    }
    const { id } = payment;
    if (latest.current.busyIds.has(id)) {
      return;
    }
    latest.current.busyIds.add(id);
    setFailure(null);
    setPhase(id, 'undoing');
    latest.current.write(id, null).then(
      () => {
        latest.current.busyIds.delete(id);
        setPhase(id, 'choosing');
        latest.current.onUndone(id);
      },
      () => {
        latest.current.busyIds.delete(id);
        setPhase(id, 'done');
        setFailure('undo');
      },
    );
  }, [payment, phase, setPhase]);

  const next = useCallback((): void => {
    if (phase !== 'done') {
      return;
    }
    const from = index;
    setFailure(null);
    // A second tap before the screen changes must not skip a payment.
    setIndex((current) => (current === from ? from + 1 : current));
  }, [phase, index]);

  const dismissFailure = useCallback((): void => setFailure(null), []);

  return {
    position: Math.min(index + 1, input.queue.length),
    total: input.queue.length,
    allDone: index >= input.queue.length,
    sortedCount: sortedPayments.size,
    row,
    options,
    picked,
    impact,
    phase,
    failure,
    nextTitle: input.queue[index + 1]?.data.title,
    pick,
    confirm,
    undo,
    next,
    dismissFailure,
  };
}

function paymentOf(row: TransactionListRow): Payment {
  return {
    id: row.data.id,
    amountMinor: row.data.amountMinor,
    currency: row.data.currency,
    suggestedPlannedItemId: row.suggestedPlannedItemId,
  };
}

function donePayments(
  queue: readonly TransactionListRow[],
  phases: ReadonlyMap<string, PaymentPhase>,
): ReadonlyMap<string, Payment> {
  const done = queue.filter((row) => {
    const phase = phases.get(row.data.id);

    return phase === 'done' || phase === 'undoing';
  });

  return new Map(done.map((row) => [row.data.id, paymentOf(row)]));
}
