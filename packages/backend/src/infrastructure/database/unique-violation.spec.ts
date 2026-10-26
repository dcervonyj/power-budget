import { describe, it, expect } from 'vitest';
import { uniqueViolationConstraint } from './unique-violation.js';

describe('uniqueViolationConstraint', () => {
  it('reads the constraint of a pg unique violation', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'users_email_unique',
    });

    expect(uniqueViolationConstraint(pgError)).toBe('users_email_unique');
  });

  it('finds the pg error in the cause of a drizzle query error', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'households_pkey',
    });

    expect(uniqueViolationConstraint(new Error('Failed query', { cause: pgError }))).toBe(
      'households_pkey',
    );
  });

  it('returns null for other errors', () => {
    const fkError = Object.assign(new Error('fk'), { code: '23503', constraint: 'fk_x' });

    expect(uniqueViolationConstraint(fkError)).toBeNull();
    expect(uniqueViolationConstraint(new Error('boom'))).toBeNull();
    expect(uniqueViolationConstraint('boom')).toBeNull();
  });
});
