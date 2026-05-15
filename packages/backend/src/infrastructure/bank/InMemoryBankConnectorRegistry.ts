import type { BankProvider } from '../../domain/bank/entities.js';
import type { BankConnector, BankConnectorRegistry } from '../../domain/bank/ports.js';

export class InMemoryBankConnectorRegistry implements BankConnectorRegistry {
  private readonly connectors = new Map<BankProvider, BankConnector>();

  register(connector: BankConnector): void {
    this.connectors.set(connector.provider, connector);
  }

  resolve(provider: BankProvider): BankConnector {
    const c = this.connectors.get(provider);
    if (!c) {
      throw new Error(`No connector registered for provider: ${provider}`);
    }

    return c;
  }

  listProviders(): BankProvider[] {
    return Array.from(this.connectors.keys());
  }
}
