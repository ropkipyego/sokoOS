import type { OutboxRecord } from "../db";

/** Maps local outbox rows into a SyncEnvelope the API will accept. */
export function buildSyncEnvelope(input: {
  tenantId: string;
  deviceId: string;
  branchId?: string | null;
  actorUserId: string;
  items: OutboxRecord[];
}): {
  envelopeId: string;
  deviceId: string;
  tenantId: string;
  branchId?: string;
  producedAt: string;
  protocolVersion: 1;
  changes: Array<{
    changeId: string;
    entityType: string;
    entityId: string;
    op: "append" | "upsert" | "delete";
    version: number;
    baseVersion: number;
    payload: unknown;
    occurredAt: string;
    actorUserId: string;
  }>;
} {
  const now = new Date().toISOString();
  return {
    envelopeId: crypto.randomUUID(),
    deviceId: input.deviceId,
    tenantId: input.tenantId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    producedAt: now,
    protocolVersion: 1,
    changes: input.items.map((item) => ({
      changeId: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      op: item.entityType === "sale" ? ("append" as const) : ("upsert" as const),
      version: 1,
      baseVersion: 0,
      payload: item.payload,
      occurredAt: item.createdAt.includes("T")
        ? item.createdAt
        : new Date(item.createdAt).toISOString(),
      actorUserId: input.actorUserId,
    })),
  };
}
