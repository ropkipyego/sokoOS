/** Safe platform defaults — never applied retroactively to historical sales. */
export const PLATFORM_CONFIG_DEFAULTS: Record<string, unknown> = {
  currencyDisplay: "symbol",
  receiptFooter: "Thank you for shopping with us",
  allowNegativeStock: false,
  requireCustomerOnCredit: true,
  defaultOrderType: "retail",
  kitchenAutoTicket: true,
  taxInclusivePricing: false,
  syncIntervalSeconds: 30,
  offlineSaleRetentionDays: 90,
  // Branding (SaaS-04) — typed keys only; overrides via ConfigSetting
  "branding.primaryColor": "#0F766E",
  "branding.secondaryColor": "#134E4A",
  "branding.accentColor": "#F59E0B",
  "branding.logoUrl": null,
  "branding.themeMode": "system",
  "branding.fontFamily": "supported",
  "branding.loginHeadline": "Welcome",
  "branding.receiptHeader": null,
  "branding.receiptFooter": "Thank you for shopping with us",
  "identity.legalName": null,
  "identity.website": null,
  "identity.address": null,
  "ops.workingHours": null,
  "pos.requireCustomer": false,
  "pos.barcodeAutoAdd": true,
  "inventory.reorderEnabled": true,
  "payments.methods": ["cash", "mpesa", "card"],
};

/** Keys tenants may override at business layer (not platform-locked). */
export const TENANT_OVERRIDABLE_KEYS = new Set([
  "receiptFooter",
  "allowNegativeStock",
  "requireCustomerOnCredit",
  "defaultOrderType",
  "kitchenAutoTicket",
  "taxInclusivePricing",
  "syncIntervalSeconds",
  "offlineSaleRetentionDays",
  "branding.primaryColor",
  "branding.secondaryColor",
  "branding.accentColor",
  "branding.logoUrl",
  "branding.themeMode",
  "branding.fontFamily",
  "branding.loginHeadline",
  "branding.receiptHeader",
  "branding.receiptFooter",
  "identity.legalName",
  "identity.website",
  "identity.address",
  "ops.workingHours",
  "pos.requireCustomer",
  "pos.barcodeAutoAdd",
  "inventory.reorderEnabled",
  "payments.methods",
]);

/** Hex color validation for branding keys. */
export function isValidBrandingValue(key: string, value: unknown): boolean {
  if (key.endsWith("Color") && typeof value === "string") {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }
  if (key === "branding.themeMode" && typeof value === "string") {
    return ["light", "dark", "system"].includes(value);
  }
  if (key === "branding.fontFamily" && typeof value === "string") {
    return ["supported", "serif", "sans"].includes(value);
  }
  return true;
}

export type ConfigLayer = "platform" | "tenant" | "branch" | "department" | "device";

export type EffectiveConfigEntry = {
  value: unknown;
  source: ConfigLayer;
};

export type EffectiveConfig = Record<string, EffectiveConfigEntry>;

export function mergeConfigLayers(
  layers: Array<{ layer: ConfigLayer; values: Record<string, unknown> }>,
): EffectiveConfig {
  const out: EffectiveConfig = {};
  for (const { layer, values } of layers) {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue;
      out[key] = { value, source: layer };
    }
  }
  return out;
}
