import { describe, it, expect } from "vitest";
import {
  applyMovementToBalance,
  computeNextBalance,
  sumQuantityDeltas,
} from "../src/inventory/stock-balance.math";

describe("stock balance update math", () => {
  it("computes next balance from signed deltas", () => {
    expect(computeNextBalance(100, -3)).toBe(97);
    expect(computeNextBalance(0, 10)).toBe(10);
    expect(computeNextBalance(5, -5)).toBe(0);
  });

  it("blocks negative stock when policy is block", () => {
    const result = applyMovementToBalance(2, -5, "block");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NEGATIVE_STOCK_BLOCKED");
      expect(result.nextQuantity).toBe(-3);
    }
  });

  it("allows negative stock with warn and surfaces warning", () => {
    const result = applyMovementToBalance(1, -2, "warn");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextQuantity).toBe(-1);
      expect(result.warning).toBeTruthy();
    }
  });

  it("sums line deltas for a multi-item sale", () => {
    // sale lines are negative
    expect(sumQuantityDeltas([-2, -1, -3])).toBe(-6);
  });
});
