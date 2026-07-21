import { z } from "zod";

export const ProductStatusSchema = z.enum(["active", "archived", "draft"]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(300),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  /** Selling price in minor currency units (e.g. cents). */
  priceMinor: z.number().int().nonnegative(),
  /** Cost in minor currency units. */
  costMinor: z.number().int().nonnegative().nullable().optional(),
  /** Tax rate in basis points (100 bps = 1%). */
  taxRateBps: z.number().int().nonnegative().default(0),
  trackInventory: z.boolean().default(true),
  status: ProductStatusSchema,
  extensions: z.record(z.unknown()).default({}),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
  deviceId: z.string().uuid().nullable().optional(),
});
export type Product = z.infer<typeof ProductSchema>;
