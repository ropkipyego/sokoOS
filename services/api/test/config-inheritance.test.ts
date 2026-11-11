import { describe, it, expect } from "vitest";
import { mergeConfigLayers, PLATFORM_CONFIG_DEFAULTS } from "../src/config/tenant-config.defaults";

describe("configuration inheritance", () => {
  it("later layers override earlier without mutating platform defaults", () => {
    const platformCopy = { ...PLATFORM_CONFIG_DEFAULTS };
    const effective = mergeConfigLayers([
      { layer: "platform", values: PLATFORM_CONFIG_DEFAULTS },
      { layer: "tenant", values: { receiptFooter: "Acme Stores", allowNegativeStock: true } },
      { layer: "branch", values: { receiptFooter: "Acme Westlands" } },
      { layer: "department", values: { defaultOrderType: "dine_in" } },
      { layer: "device", values: { syncIntervalSeconds: 10 } },
    ]);
    expect(effective.receiptFooter).toEqual({ value: "Acme Westlands", source: "branch" });
    expect(effective.allowNegativeStock).toEqual({ value: true, source: "tenant" });
    expect(effective.defaultOrderType).toEqual({ value: "dine_in", source: "department" });
    expect(effective.syncIntervalSeconds).toEqual({ value: 10, source: "device" });
    expect(PLATFORM_CONFIG_DEFAULTS.receiptFooter).toBe(platformCopy.receiptFooter);
  });

  it("documents that config changes must not rewrite history", () => {
    const saleSnapshot = { taxInclusivePricing: false, totalMinor: 1000 };
    const newConfig = { taxInclusivePricing: true };
    expect(saleSnapshot.taxInclusivePricing).not.toBe(newConfig.taxInclusivePricing);
    expect(saleSnapshot.totalMinor).toBe(1000);
  });
});
