/**
 * Pure stock balance projection math.
 * Stock is NEVER overwritten arbitrarily — only updated by appending
 * movements and applying quantityDelta to the projection.
 */

export type NegativeStockPolicy = "allow" | "warn" | "block";

export type ApplyMovementResult =
  | { ok: true; nextQuantity: number; warning?: string }
  | { ok: false; code: "NEGATIVE_STOCK_BLOCKED"; nextQuantity: number };

/**
 * Compute next balance after a signed quantity delta.
 */
export function computeNextBalance(
  currentQuantity: number,
  quantityDelta: number,
): number {
  if (!Number.isInteger(currentQuantity) || !Number.isInteger(quantityDelta)) {
    throw new RangeError("Stock quantities must be integers");
  }
  return currentQuantity + quantityDelta;
}

/**
 * Apply a movement delta under tenant negative-stock policy.
 */
export function applyMovementToBalance(
  currentQuantity: number,
  quantityDelta: number,
  policy: NegativeStockPolicy = "block",
): ApplyMovementResult {
  const nextQuantity = computeNextBalance(currentQuantity, quantityDelta);

  if (nextQuantity < 0) {
    if (policy === "block") {
      return {
        ok: false,
        code: "NEGATIVE_STOCK_BLOCKED",
        nextQuantity,
      };
    }
    if (policy === "warn") {
      return {
        ok: true,
        nextQuantity,
        warning: "Stock balance would go negative",
      };
    }
  }

  return { ok: true, nextQuantity };
}

/** Aggregate multiple deltas for the same SKU/warehouse (e.g. sale lines). */
export function sumQuantityDeltas(deltas: readonly number[]): number {
  return deltas.reduce((acc, d) => {
    if (!Number.isInteger(d)) {
      throw new RangeError("Quantity deltas must be integers");
    }
    return acc + d;
  }, 0);
}
