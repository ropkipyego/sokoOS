import { z } from "zod";
import type {
  PluginManifest,
  PluginModule,
  PluginRegistrationContext,
  PermissionDef,
  PluginMenuItem,
  PluginSettingDef,
  PluginSyncEntityDef,
} from "@sokoos/plugin-sdk";
import { validateManifest } from "@sokoos/plugin-sdk";

/** Tenant/branch settings for pharmacy operations (validated by host at load). */
export const pharmacySettingsSchema = z.object({
  requireBatchOnSale: z.boolean().default(true),
  warnDaysBeforeExpiry: z.number().int().min(1).max(365).default(90),
  blockExpiredSale: z.boolean().default(true),
  defaultNearExpirySort: z.enum(["expiry_asc", "fifo"]).default("expiry_asc"),
});

export type PharmacySettings = z.infer<typeof pharmacySettingsSchema>;

export const PHARMACY_PERMISSIONS: PermissionDef[] = [
  {
    key: "pharmacy.batches.read",
    description: "View product batches and lot numbers",
    category: "pharmacy",
  },
  {
    key: "pharmacy.batches.write",
    description: "Create and adjust pharmacy batches",
    category: "pharmacy",
  },
  {
    key: "pharmacy.expiry.read",
    description: "View expiry / near-expiry reports",
    category: "pharmacy",
  },
  {
    key: "pharmacy.expiry.manage",
    description: "Quarantine or dispose expired stock",
    category: "pharmacy",
  },
];

export const pharmacyManifest: PluginManifest = validateManifest({
  id: "soko.plugin.pharmacy",
  name: "Pharmacy",
  version: "0.1.0",
  apiVersion: 1,
  description:
    "Batches, expiry tracking, and pharmacy-specific sync entities — contracts only in this stub.",
  permissions: PHARMACY_PERMISSIONS,
  settingsSchema: pharmacySettingsSchema,
  capabilities: {
    apiRoutes: true,
    adminMenus: true,
    posExtensions: true,
    migrations: true,
    reports: true,
    jobs: true,
    settings: true,
    syncEntities: true,
  },
});

/**
 * PluginModule implementation. The host discovers this export and calls
 * register* hooks — core Nest modules are never edited for pharmacy features.
 */
export const pharmacyPlugin: PluginModule = {
  manifest: pharmacyManifest,

  registerPermissions(_ctx: PluginRegistrationContext) {
    return PHARMACY_PERMISSIONS;
  },

  registerMenus(_ctx: PluginRegistrationContext): PluginMenuItem[] {
    return [
      {
        id: "pharmacy.batches",
        label: "Batches",
        path: "/pharmacy/batches",
        surface: "admin",
        permission: "pharmacy.batches.read",
        icon: "layers",
      },
      {
        id: "pharmacy.expiry",
        label: "Expiry",
        path: "/pharmacy/expiry",
        surface: "admin",
        permission: "pharmacy.expiry.read",
        icon: "calendar",
      },
      {
        id: "pharmacy.pos.batch-picker",
        label: "Batch picker",
        path: "/pos/extensions/pharmacy-batch",
        surface: "pos",
        permission: "pharmacy.batches.read",
      },
    ];
  },

  registerSettings(_ctx: PluginRegistrationContext): PluginSettingDef[] {
    return [
      {
        key: "requireBatchOnSale",
        label: "Require batch on sale",
        description: "Cashiers must select a batch for tracked products",
        scope: "tenant",
      },
      {
        key: "warnDaysBeforeExpiry",
        label: "Near-expiry warning (days)",
        scope: "tenant",
      },
      {
        key: "blockExpiredSale",
        label: "Block sale of expired batches",
        scope: "branch",
      },
    ];
  },

  registerSyncEntities(_ctx: PluginRegistrationContext): PluginSyncEntityDef[] {
    return [
      {
        entityType: "pharmacy.batch",
        strategy: "upsert",
        schema: {
          type: "object",
          required: ["id", "productId", "lotNumber", "expiryDate"],
        },
      },
      {
        entityType: "pharmacy.batch_movement",
        strategy: "append",
        schema: {
          type: "object",
          required: ["id", "batchId", "quantityDelta"],
        },
      },
      {
        entityType: "pharmacy.expiry_event",
        strategy: "append",
      },
    ];
  },
};

export default pharmacyPlugin;
