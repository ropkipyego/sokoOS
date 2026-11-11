# SokoOS Cloud Operations

**Document:** SOKO-SAAS-OPS-001  
**Milestone:** SaaS-09  
**Status:** Documented for central SaaS hosting — verify before production cutover.

## Production topology (target)

```
Internet
  → DNS (apex, www, platform, *.sokoos.com wildcard)
  → TLS terminator / reverse proxy (wildcard + platform certs)
  → public-web (marketing + registration)
  → admin-dashboard (tenant + /platform)
  → desktop-pos (/pos path or separate host)
  → API NestJS modular monolith (:3001 internal)
  → Postgres (shared DB, tenant_id isolation)
  → Redis/BullMQ (optional workers)
  → Object storage (receipts/media)
  → Email provider (adapter)
```

## DNS / TLS

- Wildcard `*.sokoos.com` for managed tenant subdomains.
- Dedicated `platform.sokoos.com`.
- Custom domains: require ownership verification + DNS evidence before status `verified`/`active`. Never mark TLS `provisioned` without certificate evidence.
- Env: `SOKOOS_BASE_DOMAIN`, `SOKOOS_PLATFORM_HOST`, `SOKOOS_PUBLIC_HOSTS`.

## Routing

Reverse proxy maps host → app without trusting Host for authorization. API still validates JWT, membership, permissions. Unknown hosts return public unknown / 404 UX.

## Database

- Shared Postgres (ADR-003). Additive migrations (`db push` / migrate forward).
- Backups: nightly logical dump + WAL/PITR where provider supports it.
- Recovery: restore to isolated instance; verify tenant isolation queries; cut over with documented RPO/RTO.
- Never reset production DB without explicit authorization.

## Secrets

- Env vars / secret manager only. No credentials in repo or client bundles.
- `MAIL_PROVIDER`, `SMTP_URL`, JWT secrets, DB URL, payment gateway keys (future).

## Workers & email

- Redis optional locally; production should run BullMQ workers for email/sync fanout.
- Outbox statuses: queued → processing → sent → delivered (evidence only).

## Monitoring & logs

- `/health/live`, `/health/ready`, `/v1/platform/ops`.
- Retain logs without secrets/tokens/PII beyond operational need.
- Distinguish healthy / degraded / unavailable / unknown.

## Deploy / rollback

- Build API + frontends; run migrations additive; deploy API then frontends.
- Rollback: previous container image + reverse migration only if safe; prefer forward fixes.
- No deploy without authorization.

## Isolation

Logical isolation via `tenantId` from JWT. Hostname resolution is not authorization. Support agents do not get unrestricted tenant data plane access.
