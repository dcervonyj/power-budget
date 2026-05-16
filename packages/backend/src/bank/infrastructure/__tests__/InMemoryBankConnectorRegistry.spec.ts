import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBankConnectorRegistry } from '../InMemoryBankConnectorRegistry.js';
import { InMemoryBankConnector } from '../InMemoryBankConnector.js';

describe('InMemoryBankConnectorRegistry', () => {
  let registry: InMemoryBankConnectorRegistry;

  beforeEach(() => {
    registry = new InMemoryBankConnectorRegistry();
  });

  it('resolve returns the registered connector for a provider', () => {
    const connector = new InMemoryBankConnector();
    registry.register(connector);

    const resolved = registry.resolve('gocardless');
    expect(resolved).toBe(connector);
  });

  it('throws when provider not registered', () => {
    expect(() => registry.resolve('wise')).toThrow(/No connector registered for provider: wise/);
  });

  it('listProviders returns all registered providers', () => {
    const connector = new InMemoryBankConnector();
    registry.register(connector);

    const providers = registry.listProviders();
    expect(providers).toContain('gocardless');
  });

  it('register overwrites a previously registered connector', () => {
    const connector1 = new InMemoryBankConnector();
    const connector2 = new InMemoryBankConnector();
    registry.register(connector1);
    registry.register(connector2);

    expect(registry.resolve('gocardless')).toBe(connector2);
  });
});
