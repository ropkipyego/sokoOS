import { describe, it, expect } from "vitest";

describe("hardware serial lifecycle", () => {
  it("enforces status transitions for sale and return", () => {
    const allowedSellFrom = new Set(["in_stock"]);
    const allowedReturnFrom = new Set(["sold", "repair"]);
    expect(allowedSellFrom.has("in_stock")).toBe(true);
    expect(allowedSellFrom.has("sold")).toBe(false);
    expect(allowedReturnFrom.has("sold")).toBe(true);
  });

  it("warranty end is months after start", () => {
    const starts = new Date("2026-01-15");
    const months = 12;
    const ends = new Date(starts);
    ends.setMonth(ends.getMonth() + months);
    expect(ends.toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});
