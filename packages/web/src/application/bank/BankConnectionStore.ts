import { makeAutoObservable, runInAction } from 'mobx';
import type { HttpClient } from '@power-budget/shared-app';
import type {
  BankConnectionDto,
  BankConsentLinkDto,
  BankProviderDto,
  BankReconnectLinkDto,
} from '@power-budget/shared-app/contract';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import {
  BankConnectionMapper,
  type BankConnection,
} from '../../infrastructure/api/BankConnectionMapper.js';

export type BankHttp = Pick<HttpClient, 'get' | 'post'>;

export type BankActionError = 'reconnect' | 'refresh' | 'connect';

export class BankConnectionStore {
  connections: BankConnection[] = [];
  loading = false;
  error: string | null = null;
  /** A failed reconnect, refresh or connect: the list stays on screen, the screen shows this. */
  actionError: BankActionError | null = null;
  /** Connections with a refresh in flight (the card shows its chip as updating). */
  refreshingIds: string[] = [];

  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;

  constructor(private readonly http: BankHttp) {
    makeAutoObservable<BankConnectionStore, 'session' | 'http'>(this, {
      session: false,
      http: false,
    });
  }

  async fetchConnections(): Promise<void> {
    const session = this.session;
    this.loading = true;
    this.error = null;
    this.actionError = null;
    try {
      const res = await this.http.get<BankConnectionDto[]>('/bank-connections');
      this.applyConnections(session, res.data);
    } catch {
      this.applyFetchFailed(session);
    }
  }

  /** Asks the bank for a new consent; resolves to the consent page to go to, or null on failure. */
  async reconnect(id: string, redirectUri: string): Promise<string | null> {
    this.actionError = null;
    try {
      const res = await this.http.post<BankReconnectLinkDto>(`/bank-connections/${id}/reconnect`, {
        redirectUri,
      });

      return res.data.consentUrl;
    } catch {
      this.setActionError('reconnect');

      return null;
    }
  }

  /** Starts a new connection; resolves to the consent page to go to, or null on failure. */
  async connect(
    provider: BankProviderDto,
    bankId: string,
    redirectUri: string,
  ): Promise<string | null> {
    this.actionError = null;
    try {
      const res = await this.http.post<BankConsentLinkDto>('/bank-connections', {
        provider,
        bankId,
        redirectUri,
      });

      return res.data.consentUrl;
    } catch {
      this.setActionError('connect');

      return null;
    }
  }

  async refresh(id: string): Promise<void> {
    this.actionError = null;
    this.refreshingIds = [...this.refreshingIds, id];
    try {
      await this.http.post(`/bank-connections/${id}/refresh`, {});
      await this.fetchConnections();
    } catch {
      this.setActionError('refresh');
    } finally {
      this.stopRefreshing(id);
    }
  }

  /** Sign-out or session end: the previous user's connections go. */
  resetSession(): void {
    this.session += 1;
    this.connections = [];
    this.loading = false;
    this.error = null;
    this.actionError = null;
    this.refreshingIds = [];
  }

  private setActionError(action: BankActionError): void {
    runInAction(() => {
      this.actionError = action;
    });
  }

  private stopRefreshing(id: string): void {
    runInAction(() => {
      this.refreshingIds = this.refreshingIds.filter((refreshingId) => refreshingId !== id);
    });
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
