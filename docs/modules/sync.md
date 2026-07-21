# Sync Module

## Purpose

Exchange offline device changes with the cloud so sales and stock converge without cashier-operated “sync buttons.” Implements push/pull, idempotent acknowledgements, and conflict recording per `docs/architecture/02-sync-engine.md` and SRS **REQ-SYNC-***.

## Architecture

`SyncModule` in `services/api`:

- `SyncService.push` — validate envelope, classify each change (`accept_new` / `replay` / `hash_mismatch`), persist `sync_changes`, apply domain handlers  
- `SyncService.pull` — changes after device `serverSeq`, filtered by entity types  
- `SyncService.status` — device cursor / lag summary  

Wire format helpers live in `@sokoos/sync-protocol` and `@sokoos/types`. Inventory remains append-only; quantities are never last-write-wins.

## Database

`sync_changes` (idempotent `change_id`, payload hash, server sequence), `sync_conflicts`, device rows with ACK cursors. Domain tables (`sales`, `stock_movements`, catalog, …) updated by handlers inside transactions.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/sync/push` | Authenticated device/user; batch of changes |
| `POST` | `/v1/sync/pull` | Body: `serverSeq`, optional `limit`, `entityTypes`, `deviceId` |
| `GET` | `/v1/sync/status` | Current device |
| `GET` | `/v1/sync/devices/:id/status` | Admin/device inspection |

Permission `sync.force` reserved for operator overrides (future).

## UI

- **POS** — background outbox flusher; status indicator only  
- **Admin** — device sync health (scaffold); conflict queue UI TBD  

Cashiers never manually choose records to sync.

## Business Rules

- Same `changeId` + same payload hash → replay ACK (exactly-once *effect*)  
- Same `changeId` + different hash → conflict; do not apply silently  
- Stock via `append` movements; catalog via versioned upsert  
- All rows tenant-scoped from JWT; device must belong to tenant  
- Plugin entities (e.g. `pharmacy.batch`) register names via plugin SDK without core forks

## Testing

- Idempotency: `test/sync-idempotency.test.ts` (**REQ-QA-002**)  
- Conflict matrix dedicated cases (**REQ-QA-003**) — expand per entity strategy  
- Load: multi-device push ingest before scale launch (**REQ-QA-005**)

## Security

- JWT required; tenant id from token, not body spoofing  
- Device identity checked on pull/status  
- Payload size limits / throttling at edge (extend as needed)  
- Audit sensitive force-sync actions

## Future Improvements

- WebSocket push of pull hints  
- Per-entity handler registry shared with plugins  
- Dead-letter + admin resolve UI for conflicts  
- Compression and delta catalogs for low-bandwidth links  
