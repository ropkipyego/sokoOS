import { z } from "zod";

export const StockMovementTypeSchema = z.enum([
  "purchase",
  "sale",
  "return",
  "damage",
  "transfer",
  "adjustment",
]);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

/** Append-only inventory movement. Quantity is signed in base units. */
export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  type: StockMovementTypeSchema,
  quantityDelta: z.number().int(),
  unitCostMinor: z.number().int().nonnegative().nullable().optional(),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  correlationId: z.string().uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  deviceId: z.string().uuid().nullable().optional(),
  version: z.number().int().positive().default(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;
