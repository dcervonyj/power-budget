export interface DailyAllowance {
  readonly amount: bigint;
  readonly isOver: boolean;
}

/** Whole-minor-unit daily allowance. A non-positive remainder is over budget. */
export function dailyAllowance(left: bigint, daysLeft: number): DailyAllowance {
  if (left <= 0n || daysLeft <= 0) {
    return { amount: 0n, isOver: left <= 0n };
  }

  return { amount: left / BigInt(daysLeft), isOver: false };
}

export function linearForecast(spent: bigint, elapsedFraction: number): bigint;
export function linearForecast(
  spent: readonly bigint[],
  elapsedFraction: number,
): readonly bigint[];
/** Linear at-this-pace forecast for a total or each supplied line. */
export function linearForecast(
  spent: bigint | readonly bigint[],
  elapsedFraction: number,
): bigint | readonly bigint[] {
  if (typeof spent === 'bigint') {
    return forecastAmount(spent, elapsedFraction);
  }

  return spent.map((amount) => forecastAmount(amount, elapsedFraction));
}

function forecastAmount(spent: bigint, elapsedFraction: number): bigint {
  if (elapsedFraction <= 0) {
    return 0n;
  }

  const scale = 1_000_000n;
  const elapsed = BigInt(Math.round(Math.min(1, elapsedFraction) * Number(scale)));
  if (elapsed === 0n) {
    return 0n;
  }

  const numerator = spent * scale;
  const half = elapsed / 2n;
  if (numerator < 0n) {
    return (numerator - half) / elapsed;
  }

  return (numerator + half) / elapsed;
}
