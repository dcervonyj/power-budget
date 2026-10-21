import { ApiProperty } from '@nestjs/swagger';
import type { BankConnectionId } from '@power-budget/core';
import type { BankCatalogEntry, BankConnection } from '../../../domain/bank/entities.js';

export class BankCatalogEntryDto {
  @ApiProperty({ type: String, example: 'PKO_BPKOPLPW' })
  bankId!: string;

  @ApiProperty({ type: String, example: 'PKO Bank Polski' })
  name!: string;

  @ApiProperty({ type: String, example: 'PL' })
  countryCode!: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;
}

export class BankConsentLinkDto {
  @ApiProperty({ type: String, description: 'Provider consent page to redirect the user to' })
  consentUrl!: string;

  @ApiProperty({ type: String })
  connectionId!: string;
}

export class BankConsentCompletedDto {
  @ApiProperty({ type: String })
  connectionId!: string;
}

export class BankRefreshEnqueuedDto {
  @ApiProperty({ type: String, nullable: true, description: 'Sync job id, null if deduplicated' })
  jobId!: string | null;
}

export class BankReconnectLinkDto {
  @ApiProperty({ type: String, description: 'Provider consent page to redirect the user to' })
  consentUrl!: string;
}

/**
 * A bank connection as clients see it. The encrypted consent token and the
 * provider's consent reference never leave the backend (audit M7).
 */
export class BankConnectionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  householdId!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String, enum: ['gocardless', 'wise_personal'] })
  provider!: string;

  @ApiProperty({ type: String, example: 'PKO_BPKOPLPW' })
  bankId!: string;

  @ApiProperty({ type: String, enum: ['active', 'expired', 'disconnected', 'reconnect_required'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true, example: '2024-09-15T10:00:00.000Z' })
  expiresAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2024-06-15T10:00:00.000Z' })
  disconnectedAt!: string | null;

  @ApiProperty({ type: String, example: '2024-06-15T10:00:00.000Z' })
  createdAt!: string;
}

export function toBankCatalogEntryDto(entry: BankCatalogEntry): BankCatalogEntryDto {
  return {
    bankId: entry.bankId,
    name: entry.name,
    countryCode: entry.countryCode,
    logoUrl: entry.logoUrl,
  };
}

export function toBankConsentLinkDto(output: {
  readonly consentUrl: string;
  readonly connectionId: BankConnectionId;
}): BankConsentLinkDto {
  return { consentUrl: output.consentUrl, connectionId: output.connectionId };
}

export function toBankConsentCompletedDto(output: {
  readonly connectionId: BankConnectionId;
}): BankConsentCompletedDto {
  return { connectionId: output.connectionId };
}

export function toBankRefreshEnqueuedDto(output: {
  readonly jobId: string | null;
}): BankRefreshEnqueuedDto {
  return { jobId: output.jobId };
}

export function toBankReconnectLinkDto(output: {
  readonly consentUrl: string;
}): BankReconnectLinkDto {
  return { consentUrl: output.consentUrl };
}

export function toBankConnectionDto(connection: BankConnection): BankConnectionDto {
  return {
    id: connection.id,
    householdId: connection.householdId,
    userId: connection.userId,
    provider: connection.provider,
    bankId: connection.bankId,
    status: connection.status,
    expiresAt: toIsoOrNull(connection.expiresAt),
    disconnectedAt: toIsoOrNull(connection.disconnectedAt),
    createdAt: connection.createdAt.toISOString(),
  };
}

function toIsoOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}
