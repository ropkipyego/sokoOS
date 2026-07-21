import { z } from "zod";

export const SyncOpSchema = z.enum(["upsert", "append", "delete"]);
export type SyncOp = z.infer<typeof SyncOpSchema>;

export const SyncChangeSchema = z.object({
  changeId: z.string().uuid(),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  op: SyncOpSchema,
  version: z.number().int().positive(),
  /** Expected server version before apply; 0 for create. */
  baseVersion: z.number().int().nonnegative().optional(),
  payload: z.unknown(),
  occurredAt: z.string().datetime(),
  actorUserId: z.string().uuid(),
});
export type SyncChange = z.infer<typeof SyncChangeSchema>;

export const SyncEnvelopeSchema = z.object({
  envelopeId: z.string().uuid(),
  deviceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  producedAt: z.string().datetime(),
  protocolVersion: z.literal(1),
  changes: z.array(SyncChangeSchema).min(1),
});
export type SyncEnvelope = z.infer<typeof SyncEnvelopeSchema>;
