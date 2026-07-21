# SokoOS — Testing Strategy

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-QA-001 |
| **Version** | 1.0.0 |
| **Status** | Complete |
| **Maps to** | SRS **REQ-QA-001…006** |

---

## 1. Goals

Prove offline-first commerce correctness: sales never lose money or stock silently, sync converges, tenants cannot cross-read, and POS stays fast under load.

| SRS | Requirement | Strategy layer |
| --- | --- | --- |
| **REQ-QA-001** | Unit, integration, and e2e for core modules | §2–§4 |
| **REQ-QA-002** | Offline sale + sync ACK path automated | §5 |
| **REQ-QA-003** | Conflict resolution dedicated tests | §6 |
| **REQ-QA-004** | POS search + sale commit performance before RC | §7 |
| **REQ-QA-005** | Sync ingest + multi-tenant API load before scale | §7 |
| **REQ-QA-006** | Authz bypass + tenant isolation security tests | §8 |

---

## 2. Unit tests (REQ-QA-001)

**Where:** package- and service-local Vitest / `node:test` suites.

| Area | Examples |
| --- | --- |
| Inventory math | `applyMovementToBalance`, negative-stock policies (`block` / `warn` / `allow`) |
| Sync protocol | Envelope hashing, idempotent replay classification |
| Permissions | Guard matching, plugin permission key format |
| Money / IDs | Minor-unit arithmetic, uuidv7 helpers |
| Plugin stubs | Manifest validation (`@sokoos/plugin-pharmacy`) |

**Rule:** Pure domain logic has no DB. Target: every stock/sale invariant covered by a named unit test.

CI gate: `pnpm test` (Turbo).

---

## 3. Integration tests (REQ-QA-001)

**Where:** `services/api/test/*` and future Nest testing module suites against Postgres (Compose) or transactional fixtures.

| Scenario | Assert |
| --- | --- |
| Sale create | Sale + items + payments + `sale` movements + balance projection in one transaction |
| Return create | Compensating `return` movements (positive qty); cannot exceed returnable qty |
| Purchase receive | `purchase` movements restock warehouse |
| Auth login / refresh | Token pair, device bind, authz version |
| RBAC | Missing permission → 403; cross-tenant id → 404/403 |

Prefer API-level tests over mocking Prisma for money/stock paths.

---

## 4. End-to-end tests (REQ-QA-001)

**Surfaces:** Admin (Vite) + Desktop POS + API.

| Flow | Notes |
| --- | --- |
| Login → list products → checkout | Happy path online |
| Void / return from receipt | Permission-gated UI + API |
| Branch switch / warehouse default | Tenant settings respected |

Tooling (target): Playwright against seeded demo tenant. Run in CI nightly first; promote to PR when stable.

---

## 5. Offline + sync acknowledgement (REQ-QA-002)

| Step | Test |
| --- | --- |
| 1 | POS records sale to local outbox while offline |
| 2 | Connectivity restored → `POST /v1/sync/push` with change UUIDs |
| 3 | Server ACK `accepted` / `replayed`; second push same `changeId` is idempotent |
| 4 | `POST /v1/sync/pull` returns cloud catalog updates after `serverSeq` |

Existing focus: `services/api/test/sync-idempotency.test.ts`. Expand to full offline sale → ACK fixture.

---

## 6. Conflict tests (REQ-QA-003)

Dedicated cases per sync strategy (see `docs/architecture/02-sync-engine.md`):

| Conflict | Expected |
| --- | --- |
| Duplicate `changeId` different payload hash | Reject / conflict queue; no silent overwrite |
| Concurrent product edit (version skew) | Deterministic merge or conflict record |
| Stock: two devices append movements | Both append; balances recompute — never LWW quantity |
| Return after void | Validation failure, audited |

Store conflict rows in `sync_conflicts` (or equivalent) and assert auditability.

---

## 7. Performance & load (REQ-QA-004, REQ-QA-005)

| Gate | Metric (initial targets) | When |
| --- | --- | --- |
| POS product search | p95 &lt; 100 ms local SQLite / indexed API | Before release candidate |
| Sale commit | p95 &lt; 300 ms online API path | Before RC |
| Sync ingest | Sustained N devices pushing sales | Before scale launch |
| Multi-tenant fan-out | Isolated tenants under concurrent load; no cross-leak | Before scale launch |

Tools: k6 or autocannon against staging; POS micro-benchmarks in CI as smoke only.

---

## 8. Security tests (REQ-QA-006)

| Class | Cases |
| --- | --- |
| Authz bypass | Call privileged routes without JWT / without permission → 401/403 |
| Tenant isolation | Substitute another tenant’s UUIDs → not found / forbidden; never leak payloads |
| Device scope | Sync push with foreign `deviceId` rejected |
| Returns / voids | Require `returns.create` / `sales.void`; audited |

Automated in API integration suite; manual pentest before first external pilot.

---

## 9. Ownership matrix

| Layer | Owner package / folder | CI |
| --- | --- | --- |
| Unit | `packages/*`, `services/api/test`, `plugins/*` | PR |
| Integration | `services/api` + Postgres service | PR (when DB service added) |
| E2E / offline / conflict | `apps/*` + API | Nightly → PR |
| Perf / load | Staging scripts | Pre-RC / pre-scale |
| Security | API guards + dedicated suite | PR |

---

## 10. Definition of done for a module

1. Unit coverage for invariants  
2. At least one integration path for write APIs  
3. Permission keys exercised  
4. Sync entity behavior documented if offline-capable  
5. Module doc Testing section points at these suites  
