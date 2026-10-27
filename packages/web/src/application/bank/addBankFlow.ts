import type { BankProviderDto } from '@power-budget/shared-app/contract';

export type Provider = BankProviderDto;
export type Step = 'provider' | 'bank' | 'scope' | 'connect';

export interface Bank {
  readonly id: string;
  readonly name: string;
  readonly provider: Provider;
}

/**
 * The bank picker's list. The catalogue endpoint (GET /bank-connections/catalogue) has no
 * provider per entry yet, so the screen keeps this short list until it does.
 */
export const BANKS: readonly Bank[] = [
  { id: 'pko_bp', name: 'PKO BP', provider: 'gocardless' },
  { id: 'mbank', name: 'mBank', provider: 'gocardless' },
  { id: 'ing', name: 'ING Bank', provider: 'gocardless' },
  { id: 'santander', name: 'Santander', provider: 'gocardless' },
  { id: 'millennium', name: 'Bank Millennium', provider: 'gocardless' },
  { id: 'alior', name: 'Alior Bank', provider: 'gocardless' },
  { id: 'wise', name: 'Wise', provider: 'wise_personal' },
];

export function banksFor(provider: Provider | null, search: string): Bank[] {
  const query = search.trim().toLowerCase();

  return BANKS.filter(
    (bank) =>
      (provider === null || bank.provider === provider) && bank.name.toLowerCase().includes(query),
  );
}

export function previousStep(step: Step): Step {
  switch (step) {
    case 'connect':
      return 'scope';
    case 'scope':
      return 'bank';
    case 'bank':
    case 'provider':
      return 'provider';
  }
}
