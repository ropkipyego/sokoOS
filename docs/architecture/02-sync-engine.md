# SokoOS — Synchronization Engine Architecture

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-ARCH-002 |
| **Version** | 1.0.0 |
| **Status** | Baseline |
| **Depends on** | SOKO-ARCH-001, SOKO-SRS-001 (REQ-SYNC-*) |

---

## 1. Purpose

Define how devices and cloud exchange data so that:

- Cashiers never manually sync
- Sales completed offline are never lost
- Cloud state converges safely across branches and devices
- Conflicts are deterministic, auditable, and testable

---

## 2. Design Goals

| Goal | Mechanism |
| --- | --- |
| Exactly-once *effect* | Idempotent event UUIDs |
| At-least-once *delivery* | Retries with backoff |
| Causal clarity | Per-entity monotonic `version` + movement append model |
| Operability | Outbox lag metrics, ACK cursor, conflict queue |
| Security | Authenticated device identity; tenant-scoped ingest |

---

## 3. Approaches Compared

| Approach | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Last-write-wins on entire DB rows | Simple | Silent data loss; bad for stock | Reject as sole strategy |
| CRDTs everywhere | Strong merge | Heavy; hard for business docs | Reject for v1 |
| **Transactional outbox + domain-specific merge** | Practical, auditable, fits POS | Requires clear per-type rules | **Recommend** |
| Full event sourcing of all entities | Uniform | Catalog UX pain; storage cost | Hybrid only |

**Recommendation:** Transactional outbox on device and server, with **per-aggregate sync strategies** (below).

---

## 4. Core Concepts

### 4.1 Syncable entity

Any business record that may originate or update on a device or in cloud and must converge.

### 4.2 Envelope

Wire unit uploaded/downloaded:

```ts
type SyncEnvelope = {
  envelopeId: string;       // UUIDv7, idempotency key for the transport unit
  deviceId: string;
  tenantId: string;
  branchId?: string;
  producedAt: string;       // ISO-8601 local device time
  protocolVersion: 1;
  changes: SyncChange[];
};

type SyncChange = {
  changeId: string;         // UUIDv7, idempotent business change
  entityType: string;       // e.g. "sale", "stock_movement", "product"
  entityId: string;         // entity uuid
  op: "upsert" | "append" | "delete"; // delete = soft archive
  version: number;          // monotonic per entityId
  payload: unknown;         // Zod-validated per entityType
  occurredAt: string;
  actorUserId: string;
};
```

### 4.3 Sync status (local)

`pending` → `syncing` → `synced` | `failed` | `conflict`

### 4.4 Device cursor

Cloud stores per `(tenantId, deviceId)`:

- `lastEnvelopeIdAccepted`
- `serverSeq` for push channel (inbound changes watermark)

---

## 5. Local Write Path (POS)

```text
Begin SQLite transaction
  Insert/Update domain rows
  Insert stock_movement(s) if needed
  Insert outbox row(s) (pending)
Commit
Trigger/schedule sync worker (non-blocking)
Print receipt (after commit)
```

**Invariant:** Domain commit and outbox insert are atomic. A sale never exists without an outbox entry (unless explicitly non-syncable, which v1 does not allow for sales).

---

## 6. Upload Path (Device → Cloud)

1. Worker selects N pending outbox rows (batch).  
2. Mark `syncing` with attempt metadata.  
3. Build `SyncEnvelope` and POST `/v1/sync/push`.  
4. On **ACK**:
   - Mark changes `synced`
   - Store server times / assigned fields if any
5. On **retryable error**: revert to `pending`, exponential backoff + jitter.  
6. On **conflict response**: mark `conflict`, surface to manager tools; do not block other entities.  
7. On **authz rejection**: stop worker for protected ops; alert.

### Idempotency

Cloud unique constraint on `changeId` (and/or `envelopeId`). Replays return the original success ACK.

---

## 7. Download Path (Cloud → Device)

Channels:

1. **Pull:** `POST /v1/sync/pull` with device cursor / `serverSeq`  
2. **Push notify (P1):** WebSocket `catalog.updated`, `permissions.updated`, `sync.available`

Device applies inbound changes in a transaction:

- Catalog upserts by version gate
- Permission material refreshed
- Remote stock movements appended if not present (by `changeId`/`uuid`)

Inbound application must be idempotent.

---

## 8. Per-Entity Sync Strategies

| Entity | Op style | Conflict rule |
| --- | --- | --- |
| `sale` | append/upsert once | Immutable; duplicate `entityId` ignored if payload hash matches; mismatch → conflict quarantine |
| `sale_item` | with sale | Same as parent sale envelope |
| `payment` / tender | append | Idempotent by `changeId` |
| `stock_movement` | **append only** | Never overwrite; duplicate UUID no-op; no LWW |
| `product` | upsert | Higher `version` wins; loser → `sync_conflicts` |
| `category` / `brand` / `unit` | upsert | Same as product |
| `customer` / `supplier` | upsert | Higher `version` wins |
| `purchase` + items | upsert/append | Document immutable after receive; corrections via new docs |
| `expense` | upsert | Higher `version` wins |
| `settings` | upsert | Higher `version` wins; audited |
| `user_role_binding` (material) | upsert snapshot | Server authoritative when online |

### Why stock is append-only

Concurrent sales on two devices both reduce stock. LWW would drop a movement. Append-only movements commute; projection = sum(quantity_delta).

Negative stock policy enforced at **sale time** against local projection; cloud re-validates and may flag violations for manager resolution without deleting movements.

---

## 9. Versioning Rules

- Each syncable aggregate has `version` starting at 1.
- Every successful mutating change increments `version` by 1 on the writer.
- Writers include base version for upserts when updating existing entities (`baseVersion`) to detect mid-air collisions:

```ts
// Reject if server.version !== change.baseVersion for non-append entities
```

For first create, `baseVersion = 0`.

---

## 10. Clock Skew

- Devices send `occurredAt` (local) and envelope `producedAt`.
- Server stores `acceptedAt` (server clock) as authoritative for ordering in cloud reports when needed.
- If `|producedAt - serverNow| > 24h`, accept with `skewWarning` flag; do not drop sales.
- UUIDv7 provides rough time ordering for ids.

---

## 11. Cloud Ingest Pipeline

```text
API /v1/sync/push
  → AuthN + AuthZ + tenant bind
  → Validate envelope (Zod)
  → Idempotency check
  → Per-change domain handlers (in one DB transaction per envelope, or chunked with savepoints)
  → Update projections (stock_balances, etc.)
  → Write audit entries
  → Enqueue reporting/notification jobs if needed
  → Return ACK { acceptedChangeIds[], conflicts[], serverSeq }
```

Heavy fan-out (notifications, report refresh) goes to **BullMQ** after commit.

---

## 12. Snapshot & Device Reinstall

New or wiped device:

1. Register/re-register device.  
2. Pull **snapshot** for branch assignment: catalog, open stock projections, recent sales window, settings, authz material.  
3. Resume incremental sync via `serverSeq`.  
4. If local outbox existed and was backed up, restore carefully; otherwise start clean (no duplicate generation).

Snapshot format is a sync pull with `mode=snapshot`.

---

## 13. Failure Modes

| Failure | Behavior |
| --- | --- |
| Network down | Outbox grows; UI shows last sync age (non-blocking) |
| Partial batch | Unacked changes remain pending; acked stay synced |
| Poison message | After N attempts → `failed`; alert; skip to unblock queue |
| Schema protocol mismatch | Device upgrades required; server rejects with `PROTOCOL_UNSUPPORTED` |
| Disk full | Sale commit fails loudly before claiming success |

---

## 14. Security Considerations

- Sync endpoints require valid user session **and** registered `device_id`.  
- Envelope `tenantId` must match token tenant.  
- Devices cannot push for branches they are not assigned to.  
- Payload size limits and rate limits per device.  
- Conflict and audit records retained for investigation.

---

## 15. Observability

Metrics:

- `sync_outbox_depth{device_id,tenant_id}`
- `sync_push_latency_ms`
- `sync_ack_total{result}`
- `sync_conflicts_total{entity_type}`
- `sync_skew_warnings_total`

Traces: one span per envelope ingest.  
Logs: envelope id, change ids, conflict codes (no secrets).

---

## 16. Testing Strategy

| Test | Asserts |
| --- | --- |
| Unit | Version gate, merge choice, movement commutativity |
| Integration | Idempotent push, stock projection update |
| Offline E2E | Sale offline → online → cloud row + local synced |
| Chaos | Duplicate POST, reorder envelopes, kill mid-batch |
| Multi-device | Two POS sell same SKU; both movements present; qty correct |
| Security | Cross-tenant push rejected |

---

## 17. API Sketch (normative shapes; details in API phase)

- `POST /v1/sync/push` — upload envelope  
- `POST /v1/sync/pull` — download changes / snapshot  
- `GET /v1/sync/devices/:id/status` — lag, last ack (admin)  

OpenAPI in API phase must freeze these contracts.

---

## 18. Local Schema Sketch (logical)

- `outbox(id, change_id, entity_type, payload_json, version, status, attempts, next_attempt_at, ...)`
- `sync_state(device_id, server_seq, last_push_at, last_pull_at, ...)`
- `sync_conflicts(...)` (optional local cache of server conflicts)

Physical DDL belongs to Database phase.

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-15 | Initial sync engine architecture |
