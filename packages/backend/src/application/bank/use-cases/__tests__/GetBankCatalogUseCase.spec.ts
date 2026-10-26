import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  BankCatalogCache,
  BankConnector,
  BankConnectorRegistry,
} from '../../../../domain/bank/ports.js';
import type { BankCatalogEntry, BankProvider } from '../../../../domain/bank/entities.js';
import { BankRateLimitedError } from '../../../../domain/bank/errors.js';
import { BANK_CATALOG_TTL_SECONDS, GetBankCatalogUseCase } from '../GetBankCatalogUseCase.js';

const PKO: BankCatalogEntry = {
  bankId: 'PKO_PLPKOPPLPW',
  name: 'PKO BP',
  countryCode: 'PL',
  logoUrl: null,
};
const WISE: BankCatalogEntry = {
  bankId: 'wise',
  name: 'Wise',
  countryCode: 'PL',
  logoUrl: 'https://wise.com/favicon.ico',
};

describe('GetBankCatalogUseCase', () => {
  let registry: ReturnType<typeof mock<BankConnectorRegistry>>;
  let gocardless: ReturnType<typeof mock<BankConnector>>;
  let wise: ReturnType<typeof mock<BankConnector>>;
  let cache: ReturnType<typeof mock<BankCatalogCache>>;
  let useCase: GetBankCatalogUseCase;

  function resolveConnector(provider: BankProvider): BankConnector {
    return provider === 'gocardless' ? gocardless : wise;
  }

  beforeEach(() => {
    registry = mock<BankConnectorRegistry>();
    gocardless = mock<BankConnector>();
    wise = mock<BankConnector>();
    cache = mock<BankCatalogCache>();
    registry.listProviders.mockReturnValue(['gocardless', 'wise_personal']);
    registry.resolve.mockImplementation(resolveConnector);
    useCase = new GetBankCatalogUseCase(registry, cache);
  });

  it('serves a cached catalogue without calling any provider', async () => {
    cache.get.mockResolvedValue([PKO]);

    const result = await useCase.execute({ country: 'PL' });

    expect(result).toEqual([PKO]);
    expect(cache.get).toHaveBeenCalledWith('PL');
    expect(gocardless.listSupportedBanks).not.toHaveBeenCalled();
    expect(wise.listSupportedBanks).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('asks every provider on a miss and caches the result for 24 h', async () => {
    cache.get.mockResolvedValue(null);
    gocardless.listSupportedBanks.mockResolvedValue([PKO]);
    wise.listSupportedBanks.mockResolvedValue([WISE]);

    const result = await useCase.execute({ country: 'PL' });

    expect(result).toEqual([PKO, WISE]);
    expect(gocardless.listSupportedBanks).toHaveBeenCalledWith('PL');
    expect(wise.listSupportedBanks).toHaveBeenCalledWith('PL');
    expect(BANK_CATALOG_TTL_SECONDS).toBe(86_400);
    expect(cache.set).toHaveBeenCalledWith('PL', [PKO, WISE], 86_400);
  });

  it('propagates a provider rate limit and caches nothing', async () => {
    const rateLimited = new BankRateLimitedError(new Date('2026-10-26T13:00:00Z'));
    cache.get.mockResolvedValue(null);
    gocardless.listSupportedBanks.mockRejectedValue(rateLimited);
    wise.listSupportedBanks.mockResolvedValue([WISE]);

    await expect(useCase.execute({ country: 'PL' })).rejects.toBe(rateLimited);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
