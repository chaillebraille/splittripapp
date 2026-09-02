/**
 * Single source of truth for expense money maths.
 *
 * The stored truth is: each split's `amount` (in the expense currency) plus the
 * expense's `exchange_rate`. Everything else is derived, always the same way.
 */

export type SplitAmount = { amount: number };

/** Rounds to two decimals (half away from zero). */
export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** A split's amount converted into the trip settle currency. */
export function splitSettleAmount(amount: number, exchangeRate: number): number {
  return round2(Number(amount) * Number(exchangeRate));
}

/** An expense's total in its own currency: the sum of its split amounts. */
export function expenseTotal(splits: SplitAmount[]): number {
  return round2(splits.reduce((sum, s) => sum + Number(s.amount), 0));
}

/** An expense's total in the settle currency: the sum of the split settle amounts. */
export function expenseSettleTotal(splits: SplitAmount[], exchangeRate: number): number {
  return round2(
    splits.reduce((sum, s) => sum + splitSettleAmount(Number(s.amount), exchangeRate), 0),
  );
}
