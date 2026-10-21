import { makeAutoObservable, runInAction } from 'mobx';
import type { TransactionDetailDto } from '@power-budget/shared-app/contract';
import type { Transaction } from '../../domain/transactions/Transaction.js';

export interface PlannedItemLabel {
  readonly planName: string;
  readonly categoryName: string;
}

export type MappingView =
  | { readonly kind: 'checking' }
  | { readonly kind: 'unmapped' }
  | { readonly kind: 'transfer' }
  | { readonly kind: 'ignored' }
  | {
      readonly kind: 'mapped';
      readonly plannedItemId: string;
      /** Empty when the planned item is not in the loaded (active) plans. */
      readonly categoryName: string;
      readonly planName: string;
    };

interface ResolvedDetail {
  readonly plannedItemId: string | null;
  readonly transfer: boolean;
}

const CONCURRENCY = 4;

export type FetchTransactionDetail = (id: string) => Promise<TransactionDetailDto>;

/**
 * The list endpoint carries no mapping or transfer link, so this store reads the detail
 * of the listed rows (a few at a time) and answers what each row is: mapped to an item,
 * transfer, ignored, unmapped, or still being checked.
 * TODO(API): drop this once GET /transactions returns the mapping, transfer flag and
 * the mapping provenance (AI / rule / suggestion / question) on each item.
 */
export class TransactionMappingStore {
  private readonly resolved = new Map<string, ResolvedDetail>();
  private labels: ReadonlyMap<string, PlannedItemLabel> = new Map();
  private queue: string[] = [];
  private readonly inFlight = new Set<string>();

  constructor(private readonly fetchDetail: FetchTransactionDetail) {
    makeAutoObservable<TransactionMappingStore, 'fetchDetail' | 'queue' | 'inFlight'>(this, {
      fetchDetail: false,
      queue: false,
      inFlight: false,
    });
  }

  setLabels(labels: ReadonlyMap<string, PlannedItemLabel>): void {
    this.labels = labels;
  }

  /** Queues the rows whose detail is not known yet. */
  load(ids: ReadonlyArray<string>): void {
    for (const id of ids) {
      if (!this.resolved.has(id) && !this.inFlight.has(id) && !this.queue.includes(id)) {
        this.queue.push(id);
      }
    }
    this.pump();
  }

  /** Records a change made in a modal so the row updates without a reload. */
  record(id: string, detail: ResolvedDetail): void {
    this.resolved.set(id, detail);
  }

  /** Forgets everything (new filter set, after a bulk change) and refetches the given rows. */
  reset(ids: ReadonlyArray<string>): void {
    this.resolved.clear();
    this.queue = [];
    this.load(ids);
  }

  viewOf(tx: Transaction): MappingView {
    if (tx.ignored) {
      return { kind: 'ignored' };
    }
    const detail = this.resolved.get(tx.id);
    if (detail === undefined) {
      return { kind: 'checking' };
    }
    if (detail.transfer) {
      return { kind: 'transfer' };
    }
    if (detail.plannedItemId === null) {
      return { kind: 'unmapped' };
    }
    const label = this.labels.get(detail.plannedItemId);

    return {
      kind: 'mapped',
      plannedItemId: detail.plannedItemId,
      categoryName: label?.categoryName ?? '',
      planName: label?.planName ?? '',
    };
  }

  private pump(): void {
    while (this.inFlight.size < CONCURRENCY && this.queue.length > 0) {
      const id = this.queue.shift();
      if (id !== undefined) {
        this.inFlight.add(id);
        void this.fetchOne(id);
      }
    }
  }

  private async fetchOne(id: string): Promise<void> {
    try {
      const res = await this.fetchDetail(id);
      runInAction(() => {
        this.resolved.set(id, {
          plannedItemId: res.mapping?.plannedItemId ?? null,
          transfer: res.transfer !== null,
        });
      });
    } catch {
      // The row stays "checking"; it is retried on the next load().
    } finally {
      runInAction(() => {
        this.inFlight.delete(id);
        this.pump();
      });
    }
  }
}
