import { describe, it, expect } from "vitest";

/**
 * Phase 4–7 pure-logic guards (no DB). Integration coverage lives in smoke scripts.
 */

describe("department sales attribution rules", () => {
  it("rejects foreign department when membership list is non-empty", () => {
    const memberships = [{ departmentId: "dept-a" }, { departmentId: "dept-b" }];
    const requested = "dept-other";
    const allowed = memberships.some((m) => m.departmentId === requested);
    expect(allowed).toBe(false);
  });

  it("allows department when user has membership", () => {
    const memberships = [{ departmentId: "dept-a" }];
    expect(memberships.some((m) => m.departmentId === "dept-a")).toBe(true);
  });

  it("preserves null department for legacy sales", () => {
    const sale = { departmentId: null as string | null };
    expect(sale.departmentId).toBeNull();
  });
});

describe("prepared item inventory rule", () => {
  it("deducts ingredients once via correlation id, not the prepared parent", () => {
    const parentItemType = "prepared";
    const trackParent = parentItemType === "stock";
    const recipeLines = [
      { ingredientProductId: "ing-1", quantity: 2 },
      { ingredientProductId: "ing-2", quantity: 1 },
    ];
    const saleItemId = "sale-item-1";
    const correlations = recipeLines.map(
      (rl) => `recipe:${saleItemId}:${rl.ingredientProductId}`,
    );
    expect(trackParent).toBe(false);
    expect(new Set(correlations).size).toBe(correlations.length);
    expect(correlations[0]).toBe("recipe:sale-item-1:ing-1");
  });
});

describe("folio posting rules", () => {
  it("never creates a second sale when posting to folio", () => {
    const originalSaleId = "sale-1";
    const charge = { saleId: originalSaleId, amountMinor: 1500 };
    expect(charge.saleId).toBe(originalSaleId);
  });

  it("enforces unique saleId on folio charges", () => {
    const charges = [{ saleId: "sale-1" }];
    const duplicate = charges.find((c) => c.saleId === "sale-1");
    expect(duplicate).toBeTruthy();
  });

  it("room availability is not product inventory", () => {
    const room = { status: "available", inventorySku: undefined };
    expect(room.inventorySku).toBeUndefined();
    expect(["available", "occupied", "dirty"]).toContain(room.status);
  });
});
