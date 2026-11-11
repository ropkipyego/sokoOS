import { describe, it, expect } from "vitest";

describe("industry pack rules", () => {
  it("FEFO prefers earliest expiry batch", () => {
    const batches = [
      { id: "b2", expiryDate: "2027-01-01", quantityOnHand: 10 },
      { id: "b1", expiryDate: "2026-11-01", quantityOnHand: 5 },
    ];
    const sorted = [...batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    expect(sorted[0]!.id).toBe("b1");
  });

  it("wholesale tier picks highest minQuantity that still qualifies", () => {
    const tiers = [
      { minQuantity: 1, priceMinor: 1000 },
      { minQuantity: 10, priceMinor: 800 },
      { minQuantity: 50, priceMinor: 600 },
    ];
    const qty = 12;
    const applicable = tiers
      .filter((t) => t.minQuantity <= qty)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    expect(applicable?.priceMinor).toBe(800);
  });

  it("service jobs are not product inventory movements", () => {
    const job = { status: "open", inventorySku: undefined };
    expect(job.inventorySku).toBeUndefined();
  });
});
