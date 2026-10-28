import { describe, expect, it } from 'vitest';
import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../../../drizzle/schema.js';
import {
  HOUSEHOLD_PURGE_EXEMPT_TABLES,
  HOUSEHOLD_PURGED_TABLES,
} from './DrizzleHouseholdPurgeRepository.js';

function isTable(value: unknown): value is PgTable {
  return is(value, PgTable) && getTableConfig(value).name.length > 0;
}

function referencedTables(table: PgTable): string[] {
  return getTableConfig(table).foreignKeys.map(
    (fk) => getTableConfig(fk.reference().foreignTable).name,
  );
}

function hasHouseholdIdColumn(table: PgTable): boolean {
  return getTableConfig(table).columns.some((column) => column.name === 'household_id');
}

/** Tables with a household_id column, or that reference households directly or through another household-scoped table. */
function householdScopedTables(): string[] {
  const tables = Object.values(schema).filter(isTable);
  const scoped = new Set<string>(['households']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const table of tables) {
      const name = getTableConfig(table).name;
      if (
        !scoped.has(name) &&
        (hasHouseholdIdColumn(table) || referencedTables(table).some((ref) => scoped.has(ref)))
      ) {
        scoped.add(name);
        grew = true;
      }
    }
  }

  return [...scoped].sort();
}

describe('household purge coverage guard (CLN-076)', () => {
  it('covers or explicitly exempts every household-scoped table in schema.ts', () => {
    const covered = new Set([
      ...HOUSEHOLD_PURGED_TABLES,
      ...Object.keys(HOUSEHOLD_PURGE_EXEMPT_TABLES),
    ]);

    const missing = householdScopedTables().filter((name) => !covered.has(name));

    expect(
      missing,
      `add to DrizzleHouseholdPurgeRepository purge list or exempt list: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('lists no table that is not household-scoped', () => {
    const scoped = new Set(householdScopedTables());

    const stale = [
      ...HOUSEHOLD_PURGED_TABLES,
      ...Object.keys(HOUSEHOLD_PURGE_EXEMPT_TABLES),
    ].filter((name) => !scoped.has(name));

    expect(stale).toEqual([]);
  });

  it('gives every exemption a written reason', () => {
    for (const [table, reason] of Object.entries(HOUSEHOLD_PURGE_EXEMPT_TABLES)) {
      expect(reason.length, table).toBeGreaterThan(10);
    }
  });
});
