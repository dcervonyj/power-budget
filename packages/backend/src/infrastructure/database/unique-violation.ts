const UNIQUE_VIOLATION = '23505';

/**
 * The constraint or unique index a Postgres unique violation (23505) hit, or null for any
 * other error. drizzle (0.45+) wraps the pg error in a DrizzleQueryError, so the `cause`
 * chain is searched too.
 */
export function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if (Reflect.get(current, 'code') === UNIQUE_VIOLATION) {
      const constraint: unknown = Reflect.get(current, 'constraint');

      return typeof constraint === 'string' ? constraint : '';
    }
    current = Reflect.get(current, 'cause');
  }

  return null;
}
