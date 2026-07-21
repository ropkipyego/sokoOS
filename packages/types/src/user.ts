import { z } from "zod";

export const UserStatusSchema = z.enum(["active", "invited", "disabled"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  /** Null for platform owners not bound to a tenant. */
  tenantId: z.string().uuid().nullable(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  status: UserStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;
