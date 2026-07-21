import { z } from "zod";

/**
 * Core permission keys (`domain.action`).
 * Plugin permissions use a namespaced prefix (e.g. `pharmacy.manage_batches`).
 */
export const CORE_PERMISSION_KEYS = [
  // Platform
  "platform.tenants.manage",
  "platform.health.read",
  // Tenant / branch
  "tenant.settings.read",
  "tenant.settings.write",
  "branches.read",
  "branches.write",
  "devices.read",
  "devices.write",
  // Users / RBAC
  "users.read",
  "users.write",
  "roles.read",
  "roles.write",
  // Catalog
  "products.read",
  "products.write",
  "categories.read",
  "categories.write",
  // Inventory
  "inventory.read",
  "inventory.adjust",
  "inventory.transfer",
  // Sales
  "sales.create",
  "sales.read",
  "sales.void",
  "sales.discount",
  "returns.create",
  "returns.read",
  // Procurement
  "purchases.read",
  "purchases.write",
  "purchases.receive",
  "suppliers.read",
  "suppliers.write",
  // Finance
  "expenses.read",
  "expenses.write",
  "reports.read",
  // Sync / audit
  "sync.force",
  "audit.read",
  "notifications.read",
] as const;

export type PermissionKey = (typeof CORE_PERMISSION_KEYS)[number] | (string & {});

export const PermissionKeySchema = z.string().min(3).regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

export function isCorePermissionKey(key: string): key is (typeof CORE_PERMISSION_KEYS)[number] {
  return (CORE_PERMISSION_KEYS as readonly string[]).includes(key);
}
