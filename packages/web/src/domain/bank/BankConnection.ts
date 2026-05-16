export type ConnectionStatus = 'active' | 'expired' | 'error' | 'pending';

export interface BankConnection {
  id: string;
  name: string;
  provider: 'gocardless' | 'wise';
  status: ConnectionStatus;
  lastSuccessfulAt: Date | null;
  expiresAt: Date | null;
  linkedAccountIds: string[];
}
