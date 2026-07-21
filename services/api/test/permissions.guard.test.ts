import { describe, it, expect } from "vitest";
import { hasAnyPermission } from "../src/common/guards/permissions.guard";

describe("PermissionsGuard helper", () => {
  it("allows when user has any required permission (OR)", () => {
    expect(
      hasAnyPermission(["sales.create", "sales.read"], ["sales.create"]),
    ).toBe(true);
    expect(
      hasAnyPermission(["inventory.read"], ["sales.create", "inventory.read"]),
    ).toBe(true);
  });

  it("denies when none of the required permissions are present", () => {
    expect(
      hasAnyPermission(["products.read"], ["sales.create", "sales.void"]),
    ).toBe(false);
  });

  it("allows when required list is empty (no annotation)", () => {
    expect(hasAnyPermission([], [])).toBe(true);
    expect(hasAnyPermission(["sales.read"], [])).toBe(true);
  });
});
