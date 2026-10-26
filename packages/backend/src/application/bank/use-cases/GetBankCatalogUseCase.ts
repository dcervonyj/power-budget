import type { BankCatalogEntry, BankProvider, CountryCode } from '../../../domain/bank/entities.js';
import type { BankCatalogCache, BankConnectorRegistry } from '../../../domain/bank/ports.js';

export interface GetBankCatalogInput {
  readonly country: CountryCode;
}

/** Bank lists change rarely; a day keeps provider calls to about one per country per day. */
export const BANK_CATALOG_TTL_SECONDS = 24 * 60 * 60;

export class GetBankCatalogUseCase {
  constructor(
    private readonly registry: BankConnectorRegistry,
    private readonly cache: BankCatalogCache,
  ) {}

  /**
   * Served from the cache when it can be. A provider failure (for example the typed
   * BankRateLimitedError) propagates and nothing is cached.
   */
  async execute(input: GetBankCatalogInput): Promise<BankCatalogEntry[]> {
    const cached = await this.cache.get(input.country);
    if (cached !== null) {
      return cached;
    }

    const entries = await this.fetchFromProviders(input.country);
    await this.cache.set(input.country, entries, BANK_CATALOG_TTL_SECONDS);

    return entries;
  }

  private async fetchFromProviders(country: CountryCode): Promise<BankCatalogEntry[]> {
    const results = await Promise.all(
      this.registry.listProviders().map(this.listSupportedBanks.bind(this, country)),
    );

    return results.flat();
  }

  private listSupportedBanks(
    country: CountryCode,
    provider: BankProvider,
  ): Promise<BankCatalogEntry[]> {
    return this.registry.resolve(provider).listSupportedBanks(country);
  }
}
