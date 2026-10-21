import { readFileSync, existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

const MIGRATIONS = path.resolve(__dirname, '../drizzle/migrations');

interface JournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
}

interface Snapshot {
  readonly id: string;
  readonly prevId: string;
}

function readJournal(): JournalEntry[] {
  const raw = readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8');

  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

function readSnapshot(idx: number): Snapshot {
  const file = path.join(MIGRATIONS, 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`);

  return JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
}

// Applied on the live database. Renaming a tag or changing `when` makes the
// drizzle migrator treat the migration as new (or skip it), so these are frozen.
const APPLIED = [
  [0, '0000_fair_wendell_vaughn', 1778787507880],
  [1, '0001_petite_hedge_knight', 1778805350825],
  [2, '0002_fancy_tomorrow_man', 1778860930458],
  [3, '0004_be-024_sync_runs', 1778860930460],
  [4, '0004_be-030_plan_actuals_view', 1778860930461],
  [5, '0004_be-034_exports_soft_delete', 1778860930462],
  [6, '0005_be-029_email_bouncing', 1778860930463],
] as const;

describe('drizzle migration hygiene (CLN-018)', () => {
  const journal = readJournal();

  it('keeps the already-applied journal entries untouched', () => {
    const applied = journal.slice(0, APPLIED.length).map((e) => [e.idx, e.tag, e.when]);

    expect(applied).toEqual(APPLIED.map((a) => [...a]));
  });

  it('has consecutive idx and strictly increasing when', () => {
    journal.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      if (i > 0) {
        expect(entry.when).toBeGreaterThan(journal[i - 1]!.when);
      }
    });
  });

  it('has a SQL file for every journal entry and no unjournaled SQL besides 0003_rls_policies', () => {
    const tags = journal.map((e) => e.tag);
    for (const tag of tags) {
      expect(existsSync(path.join(MIGRATIONS, `${tag}.sql`)), tag).toBe(true);
    }
    const sqlFiles = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/\.sql$/, ''));
    const unjournaled = sqlFiles.filter((f) => !tags.includes(f));

    expect(unjournaled).toEqual(['0003_rls_policies']);
  });

  it('has a snapshot for every journal entry, chained by prevId', () => {
    const ids = new Set<string>();
    let prev = '00000000-0000-0000-0000-000000000000';
    for (const entry of journal) {
      const snapshot = readSnapshot(entry.idx);
      expect(snapshot.prevId, `snapshot ${entry.idx}`).toBe(prev);
      expect(ids.has(snapshot.id)).toBe(false);
      ids.add(snapshot.id);
      prev = snapshot.id;
    }
  });
});
