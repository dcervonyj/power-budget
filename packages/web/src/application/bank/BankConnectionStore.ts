import { makeAutoObservable, runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import type { BankConnection } from '../../domain/bank/BankConnection.js';

interface RawBankConnection {
  id: string;
  name: string;
  provider: 'gocardless' | 'wise';
  status: 'active' | 'expired' | 'error' | 'pending';
  lastSuccessfulAt: string | null;
  expiresAt: string | null;
  linkedAccountIds: string[];
}

function parseConnection(raw: RawBankConnection): BankConnection {
  return {
    ...raw,
    lastSuccessfulAt: raw.lastSuccessfulAt ? new Date(raw.lastSuccessfulAt) : null,
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
  };
}

export class BankConnectionStore {
  connections: BankConnection[] = [];
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get expiringConnections(): BankConnection[] {
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.connections.filter((c) => c.expiresAt !== null && c.expiresAt < threshold);
  }

  async fetchConnections(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await apiClient.get<RawBankConnection[]>('/bank-connections');
      runInAction(() => {
        this.connections = res.data.map(parseConnection);
        this.loading = false;
      });
    } catch {
      runInAction(() => {
        this.error = 'Failed to load bank connections';
        this.loading = false;
      });
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
}

export const bankConnectionStore = new BankConnectionStore();
