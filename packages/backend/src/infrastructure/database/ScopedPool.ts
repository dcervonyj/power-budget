import pg from 'pg';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { currentDbScope, toDbScopeSettings } from './DbScope.js';
import type { DbScope } from './DbScope.js';

const TRANSACTION_START = /^\s*(begin|start\s+transaction)\b/i;

/**
 * Makes every statement of a pg Pool run with the RLS settings of the current DbScope
 * (AsyncLocalStorage, set per HTTP request by DbScopeInterceptor, per process for the worker).
 *
 * - `pool.query(...)` (every drizzle statement outside a transaction) runs as
 *   BEGIN; set_config(..., true) x3; <statement>; COMMIT on one pooled connection.
 * - `pool.connect()` (drizzle `db.transaction`) returns a client that applies the same
 *   settings right after its BEGIN.
 *
 * The settings are transaction-local (`is_local = true`), so nothing leaks to the next user
 * of a pooled connection. Without a scope the statement runs as-is and RLS hides every
 * tenant row. Callback and stream (Submittable) forms of pg are passed through unscoped;
 * drizzle uses neither.
 */
export class ScopedPool {
  constructor(
    private readonly pool: Pool,
    private readonly fallbackScope: DbScope | null,
  ) {}

  static create(config: PoolConfig, fallbackScope: DbScope | null): Pool {
    const pool = new pg.Pool(config);

    return new ScopedPool(pool, fallbackScope).install();
  }

  static settingsSql(scope: DbScope): string {
    const settings = toDbScopeSettings(scope);

    return (
      `SELECT set_config('app.household_id', ${pg.escapeLiteral(settings.householdId)}, true), ` +
      `set_config('app.user_id', ${pg.escapeLiteral(settings.userId)}, true), ` +
      `set_config('app.rls_bypass', ${pg.escapeLiteral(settings.rlsBypass)}, true)`
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
    if (scope === null || this.isPassThrough(args)) {
      return Reflect.apply(pg.Pool.prototype.query, this.pool, args);
    }

    return this.queryInScope(scope, args);
  }

  connect(...args: unknown[]): unknown {
    // pg's own pool.query calls connect(callback): leave that path untouched.
    if (typeof args[0] === 'function') {
      return Reflect.apply(pg.Pool.prototype.connect, this.pool, args);
    }

    return this.connectInScope();
  }

  private resolveScope(): DbScope | null {
    return currentDbScope() ?? this.fallbackScope;
  }

  private isPassThrough(args: unknown[]): boolean {
    const first = args[0];
    const isSubmittable = typeof first === 'object' && first !== null && 'submit' in first;

    return isSubmittable || typeof args[args.length - 1] === 'function';
  }

  private async queryInScope(scope: DbScope, args: unknown[]): Promise<unknown> {
    const client = await this.rawConnect();
    try {
      await client.query(`BEGIN; ${ScopedPool.settingsSql(scope)}`);
      const result: unknown = await Reflect.apply(client.query, client, args);
      await client.query('COMMIT');
      client.release();

      return result;
    } catch (error) {
      await this.rollbackAndRelease(client);
      throw error;
    }
  }

  private async connectInScope(): Promise<PoolClient> {
    const client = await this.rawConnect();
    const scope = this.resolveScope();
    if (scope === null) {
      return client;
    }

    return new Proxy(client, new ScopedClientHandler(scope));
  }

  private async rawConnect(): Promise<PoolClient> {
    const client: PoolClient = await Reflect.apply(pg.Pool.prototype.connect, this.pool, []);

    return client;
  }

  private async rollbackAndRelease(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackError) {
      // A connection that cannot roll back is destroyed, never reused.
      client.release(rollbackError instanceof Error ? rollbackError : true);
    }
  }
}

/** Applies the scope settings right after the client's BEGIN. */
class ScopedClientHandler implements ProxyHandler<PoolClient> {
  constructor(private readonly scope: DbScope) {}

  get(target: PoolClient, property: string | symbol): unknown {
    if (property === 'query') {
      return new ScopedClientQuery(target, this.scope).bound();
    }
    const value: unknown = Reflect.get(target, property, target);

    return typeof value === 'function' ? value.bind(target) : value;
  }
}

class ScopedClientQuery {
  constructor(
    private readonly client: PoolClient,
    private readonly scope: DbScope,
  ) {}

  bound(): (...args: unknown[]) => unknown {
    return this.run.bind(this);
  }

  private run(...args: unknown[]): unknown {
    if (typeof args[args.length - 1] === 'function') {
      return Reflect.apply(this.client.query, this.client, args);
    }

    return this.runAndApplyScope(args);
  }

  private async runAndApplyScope(args: unknown[]): Promise<unknown> {
    const result: unknown = await Reflect.apply(this.client.query, this.client, args);
    if (TRANSACTION_START.test(this.statementText(args[0]))) {
      await this.client.query(ScopedPool.settingsSql(this.scope));
    }

    return result;
  }

  private statementText(statement: unknown): string {
    if (typeof statement === 'string') {
      return statement;
    }
    if (typeof statement === 'object' && statement !== null && 'text' in statement) {
      return String(statement.text);
    }

    return '';
  }
}
