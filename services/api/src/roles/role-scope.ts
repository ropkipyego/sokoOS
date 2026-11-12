/**
 * Tenant users may only be assigned roles that belong to their tenant.
 * Platform roles (null tenantId / platform_* keys) are never assignable in tenant context.
 */
export function isTenantAssignableRole(role: {
  tenantId: string | null;
  key: string;
} | null | undefined, tenantId: string): boolean {
  if (!role) return false;
  if (role.tenantId !== tenantId) return false;
  if (role.key === "platform_owner" || role.key.startsWith("platform_")) return false;
  return true;
}
