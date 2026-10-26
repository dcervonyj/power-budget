import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { and, count, eq, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  BankFetchLedgerRepository,
  FetchCallKind,
  FetchLedgerEntry,
} from '../../domain/bank/fetch-ledger.js';
import type { BankAccountId } from '../../domain/bank/entities.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

export class DrizzleBankFetchLedgerRepository implements BankFetchLedgerRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async record(entry: FetchLedgerEntry): Promise<void> {
    await this.db.insert(schema.bankFetchLedger).values({
      id: randomUUID(),
      householdId: entry.householdId,
      accountId: entry.accountId,
      connectionId: entry.connectionId,
      at: entry.at,
      callKind: entry.callKind,
      attended: entry.attended,
      httpStatus: entry.httpStatus,
      errorCode: entry.errorCode,
      syncRunId: entry.syncRunId,
    });
  }

  async countUnattendedSince(
    accountId: BankAccountId,
    callKind: FetchCallKind,
    since: Date,
  ): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(schema.bankFetchLedger)
      .where(
        and(
          eq(schema.bankFetchLedger.accountId, accountId),
          eq(schema.bankFetchLedger.callKind, callKind),
          eq(schema.bankFetchLedger.attended, false),
          gte(schema.bankFetchLedger.at, since),
        ),
      );

    return rows[0]?.n ?? 0;
  }
}
