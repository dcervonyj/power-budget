import { describe, it, expect } from 'vitest';
import { UserId, HouseholdId } from '../src/domain/auth/ids.js';
import { CategoryId } from '../src/domain/categories/ids.js';
import { InvalidIdError } from '../src/domain/shared/errors.js';

const VALID_UUIDV7 = '01956a2c-b4e0-7e34-9e18-000000000001';

describe('UserId', () => {
  it('accepts a valid UUIDv7', () => {
    const id = UserId.of(VALID_UUIDV7);
    expect(id).toBe(VALID_UUIDV7);
  });

  it('throws InvalidIdError for empty string', () => {
    expect(() => UserId.of('')).toThrow(InvalidIdError);
  });

  it('throws InvalidIdError for a UUIDv4', () => {
    expect(() => UserId.of('550e8400-e29b-41d4-a716-446655440000')).toThrow(InvalidIdError);
  });

  it('throws InvalidIdError for a malformed string', () => {
    expect(() => UserId.of('not-a-uuid')).toThrow(InvalidIdError);
  });

  it('isValid returns true for valid UUIDv7', () => {
    expect(UserId.isValid(VALID_UUIDV7)).toBe(true);
  });

  it('isValid returns false for invalid string', () => {
    expect(UserId.isValid('invalid')).toBe(false);
  });
});

describe('HouseholdId', () => {
  it('accepts a valid UUIDv7', () => {
    const id = HouseholdId.of(VALID_UUIDV7);
    expect(id).toBe(VALID_UUIDV7);
  });
});

describe('brand assignability', () => {
  // The assertion is the @ts-expect-error: `pnpm typecheck` (which includes __tests__)
  // fails if a UserId ever becomes assignable to a HouseholdId. At runtime both are the
  // same string.
  it('UserId is not assignable to HouseholdId at type level', () => {
    const userId = UserId.of(VALID_UUIDV7);
    // @ts-expect-error UserId must not be assignable to HouseholdId
    const householdId: ReturnType<typeof HouseholdId.of> = userId;
    expect(householdId).toBe(VALID_UUIDV7);
  });
});

describe('CategoryId', () => {
  it('accepts a UUIDv4 (seeded system categories)', () => {
    expect(CategoryId.of('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('accepts a UUIDv7', () => {
    expect(CategoryId.of(VALID_UUIDV7)).toBe(VALID_UUIDV7);
  });

  it('throws InvalidIdError for a malformed string', () => {
    expect(() => CategoryId.of('not-a-uuid')).toThrow(InvalidIdError);
  });
});
