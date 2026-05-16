import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectorRegistry } from '../../../domain/ports.js';
import type { BankCatalogEntry } from '../../../domain/entities.js';
import { GetBankCatalogUseCase } from '../GetBankCatalogUseCase.js';

function makeCatalogEntry(bankId: string, countryCode: string): BankCatalogEntry {
  return { bankId, name: `Bank ${bankId}`, countryCode, logoUrl: null };
}

describe('GetBankCatalogUseCase', () => {
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let useCase: GetBankCatalogUseCase;

  beforeEach(() => {
    registry = mock<BankConnectorRegistry>();
    useCase = new GetBankCatalogUseCase(registry);
  });

  it('returns empty array when no providers are registered', async () => {
    registry.listProviders.mockReturnValue([]);

    const result = await useCase.execute({ country: 'PL' });

    expect(result).toEqual([]);
  });

  it('returns banks from a single provider', async () => {
    const banks = [makeCatalogEntry('PKO_PL', 'PL'), makeCatalogEntry('ING_PL', 'PL')];
    registry.listProviders.mockReturnValue(['gocardless']);
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks: vi.fn().mockResolvedValue(banks),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    });

    const result = await useCase.execute({ country: 'PL' });

    expect(result).toHaveLength(2);
    expect(result).toEqual(banks);
  });

  it('merges and flattens results from multiple providers', async () => {
    const gcBanks = [makeCatalogEntry('PKO_PL', 'PL')];
    const wiseBanks = [makeCatalogEntry('WISE_GB', 'GB')];

    registry.listProviders.mockReturnValue(['gocardless', 'wise_personal']);
    registry.resolve.mockImplementation((provider) => ({
      provider,
      listSupportedBanks: vi.fn().mockResolvedValue(provider === 'gocardless' ? gcBanks : wiseBanks),
      initiateConsent: vi.fn(),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    }));

    const result = await useCase.execute({ country: 'PL' });

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(gcBanks[0]);
    expect(result).toContainEqual(wiseBanks[0]);
  });

  it('passes country filter to each provider', async () => {
    const listSupportedBanks = vi.fn().mockResolvedValue([]);
    registry.listProviders.mockReturnValue(['gocardless']);
    registry.resolve.mockReturnValue({
      provider: 'gocardless',
      listSupportedBanks,
      initiateConsent: vi.fn(),
      completeConsent: vi.fn(),
      listAccounts: vi.fn(),
      fetchTransactions: vi.fn(),
      refreshConsent: vi.fn(),
      disconnect: vi.fn(),
    });

    await useCase.execute({ country: 'DE' });

    expect(listSupportedBanks).toHaveBeenCalledWith('DE');
  });
});
