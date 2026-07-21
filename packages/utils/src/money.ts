/** Money helpers operating on integer minor units (cents / smallest currency unit). */

export type MoneyMinor = number;

export function assertMinor(amount: MoneyMinor, label = "amount"): asserts amount is MoneyMinor {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`${label} must be an integer minor unit, got ${amount}`);
  }
}

export function addMinor(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  assertMinor(a, "a");
  assertMinor(b, "b");
  return a + b;
}

export function subtractMinor(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  assertMinor(a, "a");
  assertMinor(b, "b");
  return a - b;
}

export function multiplyMinor(amount: MoneyMinor, qty: number): MoneyMinor {
  assertMinor(amount, "amount");
  if (!Number.isInteger(qty)) {
    throw new TypeError(`qty must be an integer, got ${qty}`);
  }
  return amount * qty;
}

/**
 * Convert a major-unit decimal string/number to minor units.
 * Uses banker's rounding via Math.round on scaled value.
 */
export function toMinor(major: number | string, fractionDigits = 2): MoneyMinor {
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n)) {
    throw new TypeError(`Invalid major amount: ${major}`);
  }
  const scale = 10 ** fractionDigits;
  return Math.round(n * scale);
}

/** Format minor units as a fixed major-unit string (no currency symbol). */
export function fromMinor(minor: MoneyMinor, fractionDigits = 2): string {
  assertMinor(minor, "minor");
  const scale = 10 ** fractionDigits;
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(fractionDigits, "0");
  return fractionDigits === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
}

/** Allocate line total: qty * unitPrice - discount + tax (all minor). */
export function lineTotalMinor(input: {
  quantity: number;
  unitPriceMinor: MoneyMinor;
  discountMinor?: MoneyMinor;
  taxMinor?: MoneyMinor;
}): MoneyMinor {
  const discount = input.discountMinor ?? 0;
  const tax = input.taxMinor ?? 0;
  return addMinor(
    subtractMinor(multiplyMinor(input.unitPriceMinor, input.quantity), discount),
    tax,
  );
}
