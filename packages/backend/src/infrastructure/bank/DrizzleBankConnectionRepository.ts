import { Inject } from '@nestjs/common';
import { eq, and, isNotNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankConnectionId, UserId, EncryptedString } from '@power-budget/core';
import type {
  BankProvider,
  BankId,
  BankConnection,
  NewBankConnection,
} from '../../domain/bank/entities.js';
import type { BankConnectionRepository, HouseholdScope } from '../../domain/bank/ports.js';
import { DRIZZLE_DB } from '../database/database.module.js';
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
        status: 'pending',
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
          this.syncable(),
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
    scope: HouseholdScope,
  ): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ encryptedConsent: consent, expiresAt })
      .where(this.inScope(id, scope));
  }

  async markActive(id: BankConnectionId, scope: HouseholdScope): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ status: 'active' })
      .where(this.inScope(id, scope));
  }

  async markDisconnected(id: BankConnectionId, at: Date, scope: HouseholdScope): Promise<void> {
    await this.db
      .update(schema.bankConnections)
      .set({ status: 'disconnected', disconnectedAt: at, encryptedConsent: null, expiresAt: null })
      .where(this.inScope(id, scope));
  }

  async findActiveConnections(): Promise<BankConnection[]> {
    const rows = await this.db.select().from(schema.bankConnections).where(this.syncable());

    return rows.map((r) => this.toEntity(r));
  }

  /** `active` with a consent: a row without one never finished (or lost) its consent. */
  private syncable(): SQL | undefined {
    return and(
      eq(schema.bankConnections.status, 'active'),
      isNotNull(schema.bankConnections.encryptedConsent),
    );
  }

  private inScope(id: BankConnectionId, scope: HouseholdScope): SQL | undefined {
    return and(
      eq(schema.bankConnections.id, id),
      eq(schema.bankConnections.householdId, scope.householdId),
    );
  }

  private toEntity(row: schema.SelectBankConnection): BankConnection {
    return {
      id: row.id,
      householdId: row.householdId,
      userId: row.userId,
      provider: row.provider,
      bankId: row.bankId,
      externalConsentRef: row.externalConsentRef,
      encryptedConsent: row.encryptedConsent,
      expiresAt: row.expiresAt,
      status: row.status,
      disconnectedAt: row.disconnectedAt,
      createdAt: row.createdAt,
    };
  }
}
