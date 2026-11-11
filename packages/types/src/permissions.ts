import { z } from "zod";

/**
 * Core permission keys (`domain.action`).
 * Plugin permissions use a namespaced prefix (e.g. `pharmacy.manage_batches`).
 */
export const CORE_PERMISSION_KEYS = [
  // Platform
  "platform.tenants.manage",
  "platform.tenants.read",
  "platform.onboarding.manage",
  "platform.audit.read",
  "platform.users.manage",
  "platform.health.read",
  "platform.domains.read",
  "platform.domains.manage",
  "platform.billing.manage",
  "platform.billing.read",
  "platform.support.manage",
  "platform.support.read",
  "platform.email.manage",
  "platform.email.read",
  "platform.devices.read",
  "platform.settings.read",
  "platform.settings.manage",
  "platform.integrations.read",
  // Tenant / branch / department
  "tenant.settings.read",
  "tenant.settings.write",
  "branches.read",
  "branches.write",
  "departments.read",
  "departments.write",
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
  "products.import",
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
  "customers.read",
  "customers.write",
  "deliveries.read",
  "deliveries.write",
  // Procurement
  "purchases.read",
  "purchases.write",
  "purchases.receive",
  "suppliers.read",
  "suppliers.write",
  // Finance
  "expenses.read",
  "expenses.write",
  "expenses.approve",
  "reports.read",
  "reports.export",
  "messages.read",
  "messages.write",
  "settings.manage",
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
