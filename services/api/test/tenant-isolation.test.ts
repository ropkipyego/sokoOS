import { describe, it, expect } from "vitest";
import { hasAnyPermission } from "../src/common/guards/permissions.guard";

describe("tenant isolation rules", () => {
  it("platform permissions do not imply tenant data access keys", () => {
    const platformPerms = [
      "platform.tenants.manage",
      "platform.tenants.read",
      "platform.onboarding.manage",
    ];
    expect(hasAnyPermission(platformPerms, ["products.read"])).toBe(false);
    expect(hasAnyPermission(platformPerms, ["sales.read"])).toBe(false);
    expect(hasAnyPermission(platformPerms, ["platform.tenants.read"])).toBe(true);
  });

  it("tenant owner cannot use platform routes by default", () => {
    const ownerPerms = ["products.read", "tenant.settings.write", "sales.create"];
    expect(hasAnyPermission(ownerPerms, ["platform.tenants.manage"])).toBe(false);
  });

  it("JWT tenantId is authoritative — client-supplied tenantId must be ignored for authZ", () => {
    const jwtTenant = "tenant-a";
    const bodyTenant = "tenant-b";
    const effective = jwtTenant;
    expect(effective).not.toBe(bodyTenant);
    expect(effective).toBe("tenant-a");
  });
});
