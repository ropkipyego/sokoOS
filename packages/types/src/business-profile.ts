import { z } from "zod";

/** Industry / operating profiles a tenant may enable (multi-select). */
export const BUSINESS_TYPES = [
  "retail",
  "supermarket",
  "restaurant",
  "hotel",
  "bar",
  "wholesale",
  "pharmacy",
  "hardware",
  "electronics",
  "services",
  "mixed",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BusinessTypeSchema = z.enum(BUSINESS_TYPES);

/** Feature packs gated per tenant. */
export const MODULE_KEYS = [
  "retail",
  "restaurant",
  "hotel",
  "pharmacy",
  "wholesale",
  "hardware",
  "services",
  "accounting",
  "deliveries",
  "e_tims",
  "mpesa",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ModuleKeySchema = z.enum(MODULE_KEYS);

export type ModulesEnabled = Partial<Record<ModuleKey, boolean>>;

/** Default modules implied by business types (union). */
export function defaultModulesForTypes(types: BusinessType[]): ModulesEnabled {
  const enabled: ModulesEnabled = { retail: true };
  for (const t of types) {
    if (t === "restaurant" || t === "bar" || t === "hotel") enabled.restaurant = true;
    if (t === "hotel") enabled.hotel = true;
    if (t === "pharmacy") enabled.pharmacy = true;
    if (t === "wholesale") enabled.wholesale = true;
    if (t === "hardware" || t === "electronics") enabled.hardware = true;
    if (t === "services") enabled.services = true;
    if (t === "supermarket" || t === "retail" || t === "mixed") enabled.retail = true;
    if (t === "mixed") {
      enabled.restaurant = true;
      enabled.retail = true;
    }
  }
  return enabled;
}

export function isModuleEnabled(modules: ModulesEnabled | null | undefined, key: ModuleKey): boolean {
  if (!modules) return key === "retail";
  if (modules[key] === true) return true;
  if (modules[key] === false) return false;
  return key === "retail";
}

export const TenantProfileSchema = z.object({
  businessTypes: z.array(BusinessTypeSchema).default(["retail"]),
  modulesEnabled: z.record(z.boolean()).default({ retail: true }),
  businessMode: z.enum(["retail", "restaurant", "hybrid"]).optional(),
});

export type TenantProfile = z.infer<typeof TenantProfileSchema>;
