import { z } from "zod";

/** Tenant lifecycle status. */
export const TenantStatusSchema = z.enum(["active", "suspended", "closed"]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: TenantStatusSchema,
  currency: z.string().length(3),
  timezone: z.string().min(1),
  locale: z.string().min(2),
  taxConfig: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;
