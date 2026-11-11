# SokoOS SaaS Target Architecture

**Document:** SOKO-SAAS-ARCH-001  
**Milestone:** SaaS-00  
**Rule:** Extend the existing modular monolith. Do not rewrite Admin, POS, or Phases 0–13.

---

## 1. Ground truth (inspected)

| Layer | Path | Status |
| --- | --- | --- |
| API | `services/api` NestJS + Prisma | Live; JWT + RBAC; `/v1` |
| Tenant admin | `apps/admin-dashboard` | Live; Vite historically `:5175` |
| POS | `apps/desktop-pos` | Live; Vite historically `:5174` |
| Platform console | `/platform/*` in admin app | Exists (overview, tenants, onboarding, health) |
| Schema | Shared Postgres, `tenantId` on business tables | ADR-003 |
| Config | `ConfigSetting` inheritance Platform→…→Terminal | Phase 9 |
| Onboarding | `OnboardingDraft` + activate transaction | Exists |
| Tenant status | string: `active` / `suspended` (partial) | Needs lifecycle expansion |

**Ports (verify before testing):** API `API_PORT` (often `3001`), Admin `5175`, POS `5174`. Restart if down.

**Locked product decisions:** subdomain URLs; dual onboarding (self-reg + platform invite); paid subscriptions; tenant branding; central cloud; central + tenant support.

---

## 2. Production hostname model

One primary product domain (illustrative: `sokoos.com`):

| Host | Audience | App surface |
| --- | --- | --- |
| `sokoos.com` / `www` | Public | Marketing + registration (`apps/public-web` — SaaS-08) |
| `platform.sokoos.com` | Platform operators | Existing `/platform` console (routing layer later) |
| `{tenant}.sokoos.com` | Business users | Tenant Admin |
| `{tenant}.sokoos.com/pos` | Frontline | POS (separate Vite app; reverse-proxy path or subdomain) |

**Dev mapping:** `{slug}.localhost`, `localhost`, `127.0.0.1` with optional `X-SokoOS-Host` for tests. Custom domains are an extension after verified DNS/TLS — never claimed without evidence.

**Security invariant:** Hostname resolution selects a *candidate* tenant context for UX and login binding. It is **not** authorization. Every mutating/read business request still requires JWT, membership, branch/department scope, and permissions.

---

## 3. Control plane modules (platform console)

| # | Module | Primary milestone |
| --- | --- | --- |
| 1 | Overview | Exists → enrich SaaS-06 |
| 2 | Businesses | Exists → lifecycle SaaS-02 |
| 3 | Onboarding | Exists → dual-path SaaS-02 |
| 4 | Domains | **SaaS-01** |
| 5 | Plans & subscriptions | SaaS-05 |
| 6 | Module entitlements | SaaS-05 |
| 7 | Platform users / roles | SaaS-06 (least-privilege roles) |
| 8 | Tenant users overview | SaaS-06 |
| 9 | Devices | SaaS-06 |
| 10 | Email & notifications | SaaS-03 |
| 11 | Support centre | SaaS-07 |
| 12 | System monitoring | SaaS-06 |
| 13 | Integrations | Exists (tenant) + platform view SaaS-06 |
| 14 | Audit & security | Extend SaaS-06/09 |
| 15 | Platform settings | SaaS-06/09 |

Platform permissions stay `platform.*` and never imply tenant data keys.

---

## 4. Tenant lifecycle states

Explicit `Tenant.status` (and related registration rows):

`registration_pending` → `awaiting_approval` → `provisioning` → `invitation_pending` → `active`  
Also: `suspended`, `deactivated`, `provisioning_failed`, plus invitation-only `invitation_pending` from platform create.

Provisioning is transactional and idempotent (correlation key). Failure retains observable state + safe retry without duplicating branch/warehouse/invite.

---

## 5. Domain resolution pipeline

```
Host header (or X-SokoOS-Host in trusted local/proxy)
  → normalize (lowercase, strip port)
  → reject empty / IP literal as "unknown" unless allowlisted for local
  → reserved / platform / public apex check
  → TenantDomain.hostname exact match (verified|active)
  → optional {slug}.{BASE_DOMAIN} inference for managed subdomains
  → outcome: public | platform | tenant | unknown | inactive | suspended | unverified_custom
```

Login binding (SaaS-01+): if host resolves to tenant T, credentials must belong to T; if platform host, prefer null-tenant platform users. Cookies/tokens must not cross tenants (separate storage keys by host in frontends later).

---

## 6. Commercial / entitlement spine (SaaS-05)

- Plans (limits, modules, price, interval) — configurable rows, not hardcoded marketing only.
- Subscriptions with states: pending, active, past_due, grace, suspended, cancelled, expired.
- Invoices + payment records; gateway behind adapter; no fake success.
- Central `EntitlementService` enforced server-side; grace/read-only without deleting data; security/export paths remain available when suspended.

---

## 7. Email (SaaS-03)

Provider adapter + outbox + BullMQ (existing queues). Dev mail adapter when credentials missing. Delivery states: queued → processing → sent → delivered/bounced/failed/retried/suppressed. Never log raw tokens.

---

## 8. Support (SaaS-07)

Tickets with tenant association; platform internal notes never exposed to tenants; support access ≠ data-plane bypass.

---

## 9. Cloud ops (SaaS-09)

Document topology, wildcard DNS, TLS, backups, workers, secrets, rollback. Shared DB multi-tenancy remains default (ADR-003). No per-tenant DB unless a future ADR.

---

## 10. Implementation sequence (locked)

| ID | Milestone | Depends on |
| --- | --- | --- |
| SaaS-00 | Audit + this architecture | — |
| SaaS-01 | TenantDomain + host resolve + platform Domains UI | SaaS-00 |
| SaaS-02 | Registration, approval, provisioning, lifecycle | SaaS-01 |
| SaaS-03 | Email centre, invitations, verification, reset | SaaS-02 |
| SaaS-04 | Branding + customization via Config Centre | SaaS-02 |
| SaaS-05 | Plans, subscriptions, invoices, entitlements | SaaS-02 |
| SaaS-06 | Platform ops, roles, monitoring enrichment | SaaS-03 |
| SaaS-07 | Support centre (platform + tenant) | SaaS-03 |
| SaaS-08 | Public website + registration UX | SaaS-02, SaaS-05 (pricing) |
| SaaS-09 | Cloud ops, security, backup/recovery docs + tests | SaaS-01–07 |
| SaaS-10 | Commercial readiness evidence pack | All prior |

Do not skip stages. Do not rebuild completed tenant commerce.

---

## 11. Definition of done (commercial SaaS)

See master directive §20. Distinguish: implemented · unit/integration tested · e2e verified · provider sandbox · production verified.
