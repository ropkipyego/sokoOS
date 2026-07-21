import { z } from "zod";

export const SaleStatusSchema = z.enum(["completed", "voided"]);
export type SaleStatus = z.infer<typeof SaleStatusSchema>;

export const SaleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  deviceId: z.string().uuid().nullable().optional(),
  cashierUserId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  status: SaleStatusSchema,
  subtotalMinor: z.number().int(),
  taxMinor: z.number().int(),
  discountMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int(),
  currency: z.string().length(3),
  receiptNumber: z.string().min(1),
  occurredAt: z.string().datetime(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const SaleItemSchema = z.object({
  id: z.string().uuid(),
  saleId: z.string().uuid(),
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  nameSnapshot: z.string().min(1),
  skuSnapshot: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative().default(0),
  taxMinor: z.number().int().nonnegative().default(0),
  lineTotalMinor: z.number().int(),
  extensions: z.record(z.unknown()).default({}),
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

export const SalePaymentMethodSchema = z.enum([
  "cash",
  "mobile_money",
  "card",
  "other",
]);
export type SalePaymentMethod = z.infer<typeof SalePaymentMethodSchema>;

export const SalePaymentSchema = z.object({
  id: z.string().uuid(),
  saleId: z.string().uuid(),
  tenantId: z.string().uuid(),
  method: SalePaymentMethodSchema,
  amountMinor: z.number().int().positive(),
  reference: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type SalePayment = z.infer<typeof SalePaymentSchema>;
