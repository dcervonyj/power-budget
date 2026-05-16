import type { BankCatalogEntry, CountryCode } from '../../domain/entities.js';
import type { BankConnectorRegistry } from '../../domain/ports.js';
import type { GetBankCatalogInput } from '../models/index.js';
export type { GetBankCatalogInput };

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
