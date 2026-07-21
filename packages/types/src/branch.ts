import { z } from "zod";

export const BranchStatusSchema = z.enum(["active", "inactive", "archived"]);
export type BranchStatus = z.infer<typeof BranchStatusSchema>;

export const BranchAddressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })
  .passthrough();
export type BranchAddress = z.infer<typeof BranchAddressSchema>;

export const BranchSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  address: BranchAddressSchema.nullable().optional(),
  status: BranchStatusSchema,
  settings: z.record(z.unknown()).default({}),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
});
export type Branch = z.infer<typeof BranchSchema>;
