import { Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankConnectionId, HouseholdId, UserId, EncryptedString } from '@power-budget/core';
import type {
  BankProvider,
  BankId,
  BankConnection,
  NewBankConnection,
  BankConnectionStatus,
} from '../domain/entities.js';
import type { BankConnectionRepository, HouseholdScope } from '../domain/ports.js';
import { DRIZZLE_DB } from '../../shared/infrastructure/database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankConnectionRepository implements BankConnectionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async create(conn: NewBankConnection): Promise<BankConnection> {
    const [row] = await this.db
      .insert(schema.bankConnections)
      .values({
        id: conn.id,
        householdId: conn.householdId,
        userId: conn.userId,
        provider: conn.provider,
        bankId: conn.bankId,
        externalConsentRef: conn.externalConsentRef,
        status: 'active',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to create bank connection');
    }

    return this.toEntity(row);
  }

  async findById(id: BankConnectionId, scope: HouseholdScope): Promise<BankConnection | null> {
    const rows = await this.db
      .select()
      .from(schema.bankConnections)
      .where(
        and(
          eq(schema.bankConnections.id, id),
          eq(schema.bankConnections.householdId, scope.householdId),
        ),
      )
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByExternalConsentRef(ref: string): Promise<BankConnection | null> {
    const rows = await this.db
      .select()
      .from(schema.bankConnections)
      .where(eq(schema.bankConnections.externalConsentRef, ref))
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findActiveByUserAndBank(
    userId: UserId,
    bankId: BankId,
    provider: BankProvider,
  ): Promise<BankConnection | null> {
    const rows = await this.db
      .select()
      .from(schema.bankConnections)
      .where(
        and(
          eq(schema.bankConnections.userId, userId),
          eq(schema.bankConnections.bankId, bankId),
          eq(schema.bankConnections.provider, provider),
          eq(schema.bankConnections.status, 'active'),
        ),
      )
      .limit(1);

    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async listByUser(userId: UserId): Promise<BankConnection[]> {
    const rows = await this.db
      .select()
      .from(schema.bankConnections)
      .where(eq(schema.bankConnections.userId, userId));

    return rows.map((r) => this.toEntity(r));
  }

  async updateConsent(
    id: BankConnectionId,
    consent: EncryptedString,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ encryptedConsent: consent, expiresAt })
      .where(eq(schema.bankConnections.id, id));
  }

  async markActive(id: BankConnectionId): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ status: 'active' })
      .where(eq(schema.bankConnections.id, id));
  }

  async markDisconnected(id: BankConnectionId, at: Date): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ status: 'disconnected', disconnectedAt: at })
      .where(eq(schema.bankConnections.id, id));
  }

  async findActiveConnections(): Promise<BankConnection[]> {
    const rows = await this.db
      .select()
      .from(schema.bankConnections)
      .where(eq(schema.bankConnections.status, 'active'));
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: schema.SelectBankConnection): BankConnection {
    return {
      id: row.id as BankConnectionId,
      householdId: row.householdId as HouseholdId,
      userId: row.userId as UserId,
      provider: row.provider as BankProvider,
      bankId: row.bankId,
      externalConsentRef: row.externalConsentRef ?? null,
      encryptedConsent: (row.encryptedConsent as EncryptedString | null) ?? null,
      expiresAt: row.expiresAt ?? null,
      status: row.status as BankConnectionStatus,
      disconnectedAt: row.disconnectedAt ?? null,
      createdAt: row.createdAt,
    };
  }
}
