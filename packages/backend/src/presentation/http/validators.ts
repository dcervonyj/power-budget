import { Transform } from 'class-transformer';

/**
 * Clamps a numeric query value to `max` (audit C5: page sizes reached the DB
 * unbounded). Non-numbers pass through untouched so `@IsInt()` can reject them.
 * Must be listed after `@Type(() => Number)` so it sees the converted value.
 */
export function ClampMax(max: number): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' && value > max ? max : value,
  );
}

/** Integer minor units, up to 18 digits (fits a Postgres bigint). */
export const MINOR_UNITS_PATTERN = /^-?\d{1,18}$/;

/**
 * Accepts a money amount in minor units as an integer string ("1500") or as a
 * safe JSON integer (1500), and normalises it to the string form. Anything else
 * is left as is so `@Matches(MINOR_UNITS_PATTERN)` rejects it.
 */
export function ToMinorUnitsString(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value,
  );
}

/** Query-string booleans: "true" / "false" become booleans, anything else is left for `@IsBoolean()`. */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    return value;
  });
}

/** Calendar date `YYYY-MM-DD` (IsoDate). */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
