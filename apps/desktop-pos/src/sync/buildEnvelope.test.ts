import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSyncEnvelope } from "./buildEnvelope.ts";

test("buildSyncEnvelope maps outbox to protocol v1 SyncEnvelope", () => {
  const changeId = crypto.randomUUID();
  const saleId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const actorUserId = crypto.randomUUID();
  const branchId = crypto.randomUUID();

  const envelope = buildSyncEnvelope({
    tenantId,
    deviceId,
    branchId,
    actorUserId,
    items: [
      {
        id: changeId,
        entityType: "sale",
        entityId: saleId,
        payload: { branchId, items: [], payments: [] },
        createdAt: new Date().toISOString(),
        attempts: 0,
      },
    ],
  });

  assert.equal(envelope.protocolVersion, 1);
  assert.equal(envelope.tenantId, tenantId);
  assert.equal(envelope.deviceId, deviceId);
  assert.equal(envelope.changes.length, 1);
  assert.equal(envelope.changes[0]?.changeId, changeId);
  assert.equal(envelope.changes[0]?.entityId, saleId);
  assert.equal(envelope.changes[0]?.op, "append");
  assert.equal(envelope.changes[0]?.actorUserId, actorUserId);
});
