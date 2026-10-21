import type {
  BankConnectionDto,
  BankConnectionStatusDto,
  BankProviderDto,
} from '@power-budget/shared-app/contract';

/** A bank connection as the web screens use it: BankConnectionDto with parsed dates. */
export interface BankConnection {
  readonly id: string;
  /** The bank's catalogue id; the API returns no display name for a connection. */
  readonly bankId: string;
  readonly provider: BankProviderDto;
  readonly status: BankConnectionStatusDto;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export const BankConnectionMapper = {
  toBankConnection(dto: BankConnectionDto): BankConnection {
    return {
      id: dto.id,
      bankId: dto.bankId,
      provider: dto.provider,
      status: dto.status,
      expiresAt: dto.expiresAt === null ? null : new Date(dto.expiresAt),
      createdAt: new Date(dto.createdAt),
    };
  },

  /** Expired and reconnect-required connections need a new consent. */
  needsReconnect(connection: BankConnection): boolean {
    return connection.status === 'expired' || connection.status === 'reconnect_required';
  },
};
