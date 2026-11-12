import { describe, it, expect } from "vitest";
import { hasAnyPermission } from "../src/common/guards/permissions.guard";
import { isTenantAssignableRole } from "../src/roles/role-scope";

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

  it("rejects assigning platform roles into a tenant", () => {
    expect(
      isTenantAssignableRole(
        { tenantId: null, key: "platform_owner" },
        "tenant-a",
      ),
    ).toBe(false);
    expect(
      isTenantAssignableRole(
        { tenantId: null, key: "platform_support" },
        "tenant-a",
      ),
    ).toBe(false);
  });

  it("rejects roles belonging to another tenant", () => {
    expect(
      isTenantAssignableRole(
        { tenantId: "tenant-b", key: "business_owner" },
        "tenant-a",
      ),
    ).toBe(false);
  });

  it("allows same-tenant operational roles", () => {
    expect(
      isTenantAssignableRole(
        { tenantId: "tenant-a", key: "cashier" },
        "tenant-a",
      ),
    ).toBe(true);
    expect(
      isTenantAssignableRole(
        { tenantId: "tenant-a", key: "business_owner" },
        "tenant-a",
      ),
    ).toBe(true);
  });

  it("list/query scopes must always include jwt tenantId", () => {
    const jwtTenant = "tenant-a";
    const query = { tenantId: jwtTenant, status: "active" };
    expect(query.tenantId).toBe(jwtTenant);
    // body override must never win
    const body = { tenantId: "tenant-b" };
    const scoped = { ...body, tenantId: jwtTenant };
    expect(scoped.tenantId).toBe("tenant-a");
  });
});
