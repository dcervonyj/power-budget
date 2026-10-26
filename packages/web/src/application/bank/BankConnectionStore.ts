import { makeAutoObservable, runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import { clientSession } from '../auth/ClientSession.js';
import type { BankConnectionDto } from '@power-budget/shared-app/contract';
import {
  BankConnectionMapper,
  type BankConnection,
} from '../../infrastructure/api/BankConnectionMapper.js';

export class BankConnectionStore {
  connections: BankConnection[] = [];
  loading = false;
  error: string | null = null;

  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;

  constructor() {
    makeAutoObservable<BankConnectionStore, 'session'>(this, { session: false });
  }

  get expiringConnections(): BankConnection[] {
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.connections.filter((c) => c.expiresAt !== null && c.expiresAt < threshold);
  }

  async fetchConnections(): Promise<void> {
    const session = this.session;
    this.loading = true;
    this.error = null;
    try {
      const res = await apiClient.get<BankConnectionDto[]>('/bank-connections');
      this.applyConnections(session, res.data);
    } catch {
      this.applyFetchFailed(session);
    }
  }

  async reconnect(id: string): Promise<void> {
    try {
      await apiClient.post(`/bank-connections/${id}/reconnect`, {});
      await this.fetchConnections();
    } catch {
      runInAction(() => {
        this.error = 'Failed to reconnect';
      });
    }
  }

  async refresh(id: string): Promise<void> {
    try {
      await apiClient.post(`/bank-connections/${id}/refresh`, {});
      await this.fetchConnections();
    } catch {
      runInAction(() => {
        this.error = 'Failed to refresh';
      });
    }
  }

  /** Sign-out or session end: the previous user's connections go. */
  resetSession(): void {
    this.session += 1;
    this.connections = [];
    this.loading = false;
    this.error = null;
  }

  private applyConnections(session: number, connections: BankConnectionDto[]): void {
    if (session !== this.session) {
      return;
    }
    this.connections = connections.map(BankConnectionMapper.toBankConnection);
    this.loading = false;
  }

  private applyFetchFailed(session: number): void {
    if (session !== this.session) {
      return;
    }
    this.error = 'Failed to load bank connections';
    this.loading = false;
  }
}

export const bankConnectionStore = new BankConnectionStore();
clientSession.register(bankConnectionStore);
