# SokoOS SaaS Commercial Readiness

**Document:** SOKO-SAAS-READY-001  
**Updated:** 2026-10-31

## Definition of done vs evidence

| # | Criterion | Status | Evidence class |
| --- | --- | --- | --- |
| 1 | Prospect can register | Implemented | API + public-web form; unit/e2e local |
| 2 | Platform reviews/approves | Implemented | `/platform/registrations` |
| 3 | Platform creates client | Implemented | `POST /platform/clients` + onboarding wizard |
| 4 | Provisioning idempotent | Implemented | `idempotencyKey` reuse verified locally |
| 5 | Tenant subdomain resolves | Implemented | `GET /public/resolve-host` + TenantDomain |
| 6 | Secure email invitation | Implemented (dev adapter) | Outbox `sent`; production SMTP not verified |
| 7 | Admin activates account | Implemented | `/activate` + `POST /public/invitations/accept` |
| 8 | Admin configures business | Implemented | Config Centre + branding keys |
| 9 | Tenant invites employees | Partial | Invitation model + resend; employee UI invite TBD |
| 10 | Operate via Admin/POS | Preserved | Existing apps intact |
| 11 | Subscription/entitlements | Implemented | Plans, assign, assertWrite on sales |
| 12 | Platform manages lifecycle | Implemented | Domains, billing, support, ops |
| 13 | Support tickets | Implemented | Platform + tenant APIs/UI |
| 14 | Monitoring real evidence | Implemented | `/platform/ops` counters |
| 15 | Isolation security tests | Partial | Contract tests; expand adversarial suite |
| 16 | Backup/recovery | Documented | `SOKOOS-CLOUD-OPS.md` — not production-verified |
| 17 | Consistent UI | Partial | Platform shell expanded; public-web new |

## Verification classes

- **Implemented:** code + schema present
- **Automated tests:** API vitest (65+)
- **E2E local:** registration→provision; invite accept; plans seed; resolve-host
- **Provider sandbox:** email SMTP / payments / DNS-TLS — **not done** (credentials absent)
- **Production verified:** **not claimed**

## Remaining limitations

- Live recurring billing gateway not connected (by design until credentials)
- Custom domain TLS/DNS not auto-provisioned
- Employee invite UX incomplete
- `nest start --watch` emit flake — use `tsc -p tsconfig.build.json && node dist/main.js` until fixed
- Public web needs `pnpm install` in workspace after add
