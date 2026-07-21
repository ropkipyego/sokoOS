import { describe, it, expect } from "vitest";

/**
 * Pure helper mirroring ReturnsService remaining-qty checks
 * (sold − alreadyReturned − requested).
 */
function remainingReturnable(
  soldQty: number,
  alreadyReturned: number,
  requested: number,
): { ok: true; remainingAfter: number } | { ok: false; remaining: number } {
  const remaining = soldQty - alreadyReturned;
  if (requested < 1 || requested > remaining) {
    return { ok: false, remaining };
  }
  return { ok: true, remainingAfter: remaining - requested };
}

describe("returns quantity rules", () => {
  it("allows partial return within sold qty", () => {
    const r = remainingReturnable(5, 0, 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remainingAfter).toBe(3);
  });

  it("blocks over-return after prior returns", () => {
    const r = remainingReturnable(5, 3, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.remaining).toBe(2);
  });

  it("allows returning the exact remainder", () => {
    const r = remainingReturnable(5, 3, 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remainingAfter).toBe(0);
  });
});
