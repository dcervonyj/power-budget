import { Inject } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { uuidv7 } from 'uuidv7';
import { FxRateId, IsoDate, IsoDateTime, isSupportedCurrency } from '@power-budget/core';
import type { CurrencyCode, FxRateSource, FxRateTable } from '@power-budget/core';
import type { FxRate, FxRateRepository, NewFxRate } from '../../domain/fx/index.js';
import { DRIZZLE_DB } from '../database/database.module.js';
import * as schema from '../../../drizzle/schema.js';

type FxRateRow = typeof schema.fxRates.$inferSelect;

const ONE_DAY_MS = 86_400_000;
const SOURCES: readonly FxRateSource[] = ['ecb', 'nbp', 'manual'];

/**
 * fx_rates is global reference data (no household_id), so these methods take
 * no HouseholdScope. `rate` is numeric(24, 10): written and read as a decimal
 * string, never through a JS number.
 */
export class DrizzleFxRateRepository implements FxRateRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase<typeof schema>) {}

  async saveBatch(rates: readonly NewFxRate[]): Promise<number> {
    if (rates.length === 0) {
      return 0;
    }
    const inserted = await this.db
      .insert(schema.fxRates)
      .values(
        rates.map((rate) => ({
          id: uuidv7(),
          base: rate.baseCurrency,
          quote: rate.quoteCurrency,
          rateOnDate: rate.rateDate,
          rate: rate.rate,
          source: rate.source,
          fetchedAt: new Date(rate.fetchedAt),
        })),
      )
      .onConflictDoNothing({
        target: [schema.fxRates.base, schema.fxRates.quote, schema.fxRates.rateOnDate],
      })
      .returning({ id: schema.fxRates.id });

    return inserted.length;
  }

  async getTable(asOf: IsoDate, maxAgeDays: number): Promise<FxRateTable> {
    const oldest = new Date(Date.parse(`${asOf}T00:00:00.000Z`) - maxAgeDays * ONE_DAY_MS)
      .toISOString()
      .slice(0, 10);
    const rows = await this.db
      .selectDistinctOn([schema.fxRates.base, schema.fxRates.quote])
      .from(schema.fxRates)
      .where(and(lte(schema.fxRates.rateOnDate, asOf), gte(schema.fxRates.rateOnDate, oldest)))
      .orderBy(
        asc(schema.fxRates.base),
        asc(schema.fxRates.quote),
        desc(schema.fxRates.rateOnDate),
      );
    const table = new Map<string, FxRate>();
    for (const row of rows) {
      const rate = this.toEntity(row);
      if (rate !== null) {
        table.set(`${rate.baseCurrency}/${rate.quoteCurrency}`, rate);
      }
    }

    return table;
  }

  async getRate(base: CurrencyCode, quote: CurrencyCode, date: IsoDate): Promise<FxRate | null> {
    const rows = await this.db
      .select()
      .from(schema.fxRates)
      .where(
        and(
          eq(schema.fxRates.base, base),
          eq(schema.fxRates.quote, quote),
          eq(schema.fxRates.rateOnDate, date),
        ),
      )
      .limit(1);
    const row = rows[0];

    return row === undefined ? null : this.toEntity(row);
  }

  async listQuoteCurrencies(base: CurrencyCode, date: IsoDate): Promise<CurrencyCode[]> {
    const rows = await this.db
      .select({ quote: schema.fxRates.quote })
      .from(schema.fxRates)
      .where(and(eq(schema.fxRates.base, base), eq(schema.fxRates.rateOnDate, date)));
    const quotes: CurrencyCode[] = [];
    for (const { quote } of rows) {
      if (isSupportedCurrency(quote)) {
        quotes.push(quote);
      }
    }

    return quotes;
  }

  /** Rows with a currency or source this build does not know are skipped, not guessed. */
  private toEntity(row: FxRateRow): FxRate | null {
    const source = SOURCES.find((known) => known === row.source);
    if (!isSupportedCurrency(row.base) || !isSupportedCurrency(row.quote) || source === undefined) {
      return null;
    }

    return {
      id: FxRateId.of(row.id),
      baseCurrency: row.base,
      quoteCurrency: row.quote,
      rate: this.normaliseDecimal(row.rate),
      rateDate: IsoDate.of(row.rateOnDate),
      source,
      fetchedAt: IsoDateTime.of(row.fetchedAt.toISOString()),
    };
  }

  /** numeric(24, 10) comes back padded ("4.3768000000"); drop the padding only. */
  private normaliseDecimal(value: string): string {
    return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
  }
}
