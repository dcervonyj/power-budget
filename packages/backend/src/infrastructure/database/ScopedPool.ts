import pg from 'pg';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { currentDbScope, toDbScopeSettings } from './DbScope.js';
import type { DbScope, DbScopeSettings } from './DbScope.js';

/** What a statement without any DbScope runs under: RLS hides every tenant row. */
const UNSCOPED_SETTINGS: DbScopeSettings = { householdId: '', userId: '', rlsBypass: 'off' };

/** SQLSTATE classes after which the connection itself is unusable (08: connection, 57P: shutdown). */
const BROKEN_CONNECTION_CODE = /^(08|57P)/;

type ConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: boolean | Error) => void,
) => void;

type QueryCallback = (error: Error | undefined, result?: unknown) => void;

/**
 * Makes every statement of a pg Pool run with the RLS settings of the current DbScope
 * (AsyncLocalStorage, set per HTTP request by DbScopeInterceptor, per process for the worker).
 *
 * The settings live on the connection (`set_config(..., false)`, session level). Every checkout
 * (`pool.query`, `pool.connect`, promise or callback form) compares the scope of the caller with
 * the settings that connection last received and sends one `set_config` only when they differ.
 * A run of statements of one tenant therefore costs one round trip per statement, with no
 * BEGIN/COMMIT around single statements. A statement without a scope gets the empty settings,
 * so a reused connection never serves one scope the settings of another.
 *
 * The scope is resolved when `query`/`connect` is called, not when pg hands the connection out,
 * so a caller queued behind a busy pool keeps its own scope.
 *
 * The cache is only sound because the settings are written on an idle connection (autocommit),
 * so no later ROLLBACK can undo them. ScopedPool therefore follows the transaction status
 * Postgres reports with every ReadyForQuery: a connection released inside a transaction (open or
 * failed) is destroyed together with its cached settings, and a checkout never writes settings on
 * a connection that is not idle.
 *
 * Invariant: nothing else writes these settings at session level. Transaction-local writes
 * (`set_config(..., true)`, e.g. refresh_plan_actuals) revert to the session value and are fine.
 */
export class ScopedPool {
  private readonly appliedSql = new WeakMap<PoolClient, string>();
  private readonly transactions = new TransactionStatusTracker();

  constructor(
    private readonly pool: Pool,
    private readonly fallbackScope: DbScope | null,
  ) {}

  static create(config: PoolConfig, fallbackScope: DbScope | null): Pool {
    const pool = new pg.Pool(config);

    return new ScopedPool(pool, fallbackScope).install();
  }

  static settingsSql(scope: DbScope | null): string {
    const settings = scope === null ? UNSCOPED_SETTINGS : toDbScopeSettings(scope);

    return (
      `SELECT set_config('app.household_id', ${pg.escapeLiteral(settings.householdId)}, false), ` +
      `set_config('app.user_id', ${pg.escapeLiteral(settings.userId)}, false), ` +
      `set_config('app.rls_bypass', ${pg.escapeLiteral(settings.rlsBypass)}, false)`
    );
  }

  /**
   * Replaces `query` and `connect` on the instance. pg declares both with many overloads, so
   * an override in a subclass cannot be typed; defineProperty keeps the Pool type intact.
   */
  install(): Pool {
    Object.defineProperty(this.pool, 'query', {
      value: this.query.bind(this),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(this.pool, 'connect', {
      value: this.connect.bind(this),
      configurable: true,
      writable: true,
    });

    return this.pool;
  }

  query(...args: unknown[]): unknown {
    const scope = this.resolveScope();
    const callback = args[args.length - 1];
    if (ScopedPool.isSubmittable(args[0])) {
      // pg's own query checks out through this.connect(callback), which applies the scope.
      return Reflect.apply(pg.Pool.prototype.query, this.pool, args);
    }
    if (ScopedPool.isQueryCallback(callback)) {
      this.queryInScope(scope, args.slice(0, -1)).then(
        ScopedPool.deliverResult.bind(null, callback),
        callback,
      );

      return undefined;
    }

    return this.queryInScope(scope, args);
  }

  connect(...args: unknown[]): unknown {
    const scope = this.resolveScope();
    const callback = args[0];
    if (ScopedPool.isConnectCallback(callback)) {
      this.checkout(scope).then(
        ScopedPool.handOver.bind(null, callback),
        ScopedPool.refuseCheckout.bind(null, callback),
      );

      return undefined;
    }

    return this.checkout(scope);
  }

  private static isSubmittable(statement: unknown): boolean {
    return typeof statement === 'object' && statement !== null && 'submit' in statement;
  }

  private static isQueryCallback(value: unknown): value is QueryCallback {
    return typeof value === 'function';
  }

  private static isConnectCallback(value: unknown): value is ConnectCallback {
    return typeof value === 'function';
  }

  private static deliverResult(callback: QueryCallback, result: unknown): void {
    callback(undefined, result);
  }

  private static handOver(callback: ConnectCallback, client: PoolClient): void {
    callback(undefined, client, client.release);
  }

  private static refuseCheckout(callback: ConnectCallback, error: unknown): void {
    callback(ScopedPool.toError(error), undefined, ScopedPool.nothingToRelease);
  }

  private static nothingToRelease(): void {
    // A failed checkout has no connection to give back.
  }

  private static releaseWithResult(client: PoolClient, result: unknown): unknown {
    client.release();

    return result;
  }

  /** A statement the database rejected leaves the connection idle and usable: keep it. */
  private static releaseWithError(client: PoolClient, error: unknown): never {
    client.release(ScopedPool.keepsConnection(error) ? undefined : ScopedPool.toError(error));
    throw error;
  }

  private static keepsConnection(error: unknown): boolean {
    return error instanceof pg.DatabaseError && !BROKEN_CONNECTION_CODE.test(error.code ?? '');
  }

  private static toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private resolveScope(): DbScope | null {
    return currentDbScope() ?? this.fallbackScope;
  }

  private async queryInScope(scope: DbScope | null, args: unknown[]): Promise<unknown> {
    const client = await this.checkout(scope);

    return this.send(client, args).then(
      ScopedPool.releaseWithResult.bind(null, client),
      ScopedPool.releaseWithError.bind(null, client),
    );
  }

  /** async so a synchronous throw of pg (e.g. an empty statement) becomes a rejection. */
  private async send(client: PoolClient, args: unknown[]): Promise<unknown> {
    const result: unknown = await Reflect.apply(client.query, client, args);

    return result;
  }

  private async checkout(scope: DbScope | null): Promise<PoolClient> {
    const client: PoolClient = await Reflect.apply(pg.Pool.prototype.connect, this.pool, []);
    this.transactions.follow(client);
    client.release = new GuardedRelease(
      client,
      client.release,
      this.transactions,
      this.appliedSql,
    ).bound();
    try {
      await this.applyScope(client, scope);
    } catch (error) {
      // The settings of this connection are unknown now: destroy it, never reuse it.
      client.release(ScopedPool.toError(error));
      throw error;
    }

    return client;
  }

  private async applyScope(client: PoolClient, scope: DbScope | null): Promise<void> {
    const sql = ScopedPool.settingsSql(scope);
    if (!this.transactions.isIdle(client)) {
      throw new Error('ScopedPool: refusing a connection that is inside a transaction');
    }
    if (this.appliedSql.get(client) === sql) {
      return;
    }
    this.appliedSql.delete(client);
    await client.query(sql);
    this.appliedSql.set(client, sql);
  }
}

/**
 * Records the transaction status of each connection from Postgres' ReadyForQuery message:
 * 'I' idle, 'T' inside a transaction block, 'E' inside a failed transaction block.
 * A connection it cannot follow counts as not idle, so it is never reused with cached settings.
 */
class TransactionStatusTracker {
  private readonly statuses = new WeakMap<PoolClient, string>();

  follow(client: PoolClient): void {
    if (this.statuses.has(client) || !(client instanceof pg.Client)) {
      return;
    }
    // pg hands out a connection only between statements, so a newly followed one is idle.
    this.statuses.set(client, 'I');
    client.connection.on('readyForQuery', this.record.bind(this, client));
  }

  isIdle(client: PoolClient): boolean {
    return this.statuses.get(client) === 'I';
  }

  private record(client: PoolClient, message: unknown): void {
    if (typeof message === 'object' && message !== null && 'status' in message) {
      this.statuses.set(client, String(message.status));
    }
  }
}

/** Destroys a connection given back inside a transaction, and forgets its settings. */
class GuardedRelease {
  constructor(
    private readonly client: PoolClient,
    private readonly release: (error?: Error | boolean) => void,
    private readonly transactions: TransactionStatusTracker,
    private readonly appliedSql: WeakMap<PoolClient, string>,
  ) {}

  bound(): (error?: Error | boolean) => void {
    return this.run.bind(this);
  }

  private run(error?: Error | boolean): void {
    const reason = error || this.unusableReason();
    if (reason) {
      this.appliedSql.delete(this.client);
    }
    this.release(reason || undefined);
  }

  private unusableReason(): Error | false {
    if (this.transactions.isIdle(this.client)) {
      return false;
    }

    return new Error('ScopedPool: connection released inside a transaction');
  }
}
