# Offline POS — verified operations

**Document:** SOKO-IMPL-OFFLINE-001  
**Updated:** 2026-10-30

## Works offline (local durable store + outbox)

| Operation | Behaviour |
| --- | --- |
| Browse seeded/cached catalogue | Local DB |
| Build cart / apply tender locally | Local cart store |
| Persist sale + stock movement locally | MemoryLocalDb/SqliteLocalDb with outbox |
| Survive app restart with pending outbox | Outbox reloaded from local persistence |
| Queue sync for later | `SyncWorker` retains failed items |

## Requires connectivity

| Operation | Why |
| --- | --- |
| Login / token refresh | JWT from API |
| Live product/image pull | Server catalogue |
| M-Pesa STK / payment confirmation | Provider + verified callback |
| eTIMS fiscal acknowledgement | Provider |
| Kitchen ticket fan-out to other devices | Server |
| Hotel folio posting across departments | Server |
| Platform onboarding | Server |

## Sync guarantees (automated-test verified)

- `changeId` idempotency on `/sync/push` (duplicate payload accepted; different payload conflicts).
- Connectivity ≠ synced: `SyncWorker` statuses `offline` | `error` | `synced`; `getPendingCount()`.
- Inventory movements use `correlationId` so retries do not double-deduct when applied server-side.

## Not yet hardware-verified

Physical device power-loss, multi-day offline, and contested Wi‑Fi flapping need device lab runs before claiming production offline readiness.
