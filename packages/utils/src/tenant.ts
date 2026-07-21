/**
 * Assert that a tenant id is present and matches an expected scope.
 * Used at repository / service boundaries to prevent cross-tenant access.
 */
export function assertTenant(
  tenantId: string | null | undefined,
  expected?: string,
): asserts tenantId is string {
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("Missing tenantId");
  }
  if (expected !== undefined && tenantId !== expected) {
    throw new Error("Tenant mismatch");
  }
}
