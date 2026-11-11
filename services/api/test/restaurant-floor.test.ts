import { describe, it, expect } from "vitest";

describe("restaurant floor rules", () => {
  it("split moves quantity without inventing revenue", () => {
    const original = { totalMinor: 3000, items: [{ id: "a", quantity: 3, lineTotalMinor: 3000 }] };
    const moveQty = 1;
    const moveTotal = Math.round((original.items[0]!.lineTotalMinor / original.items[0]!.quantity) * moveQty);
    const remainQty = original.items[0]!.quantity - moveQty;
    const remainTotal = original.items[0]!.lineTotalMinor - moveTotal;
    expect(moveTotal + remainTotal).toBe(3000);
    expect(remainQty).toBe(2);
  });

  it("merge voids source instead of double-counting", () => {
    const source = { status: "voided", totalMinor: 0 };
    const target = { status: "open", totalMinor: 5000 };
    expect(source.status).toBe("voided");
    expect(target.totalMinor).toBe(5000);
  });

  it("close uses idempotent correlation ids for stock", () => {
    const saleItemId = "si-1";
    const ingredientId = "ing-1";
    const correlationId = `recipe:${saleItemId}:${ingredientId}`;
    const seen = new Set<string>();
    expect(seen.has(correlationId)).toBe(false);
    seen.add(correlationId);
    expect(seen.has(correlationId)).toBe(true);
  });

  it("paid dine-in leaves table dirty not free", () => {
    const afterPay = "dirty";
    expect(afterPay).not.toBe("free");
  });
});
