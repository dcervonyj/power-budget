import type { BankCatalogEntry, CountryCode } from '../../../domain/bank/entities.js';
import type { BankConnectorRegistry } from '../../../domain/bank/ports.js';

export interface GetBankCatalogInput {
  readonly country: CountryCode;
}

export class GetBankCatalogUseCase {
  constructor(private readonly registry: BankConnectorRegistry) {}

  async execute(input: GetBankCatalogInput): Promise<BankCatalogEntry[]> {
    const providers = this.registry.listProviders();
    const results = await Promise.all(
      providers.map((p) => this.registry.resolve(p).listSupportedBanks(input.country)),
    );

    return results.flat();
  }
}
