# SokoOS — Security Architecture

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-ARCH-004 |
| **Version** | 1.0.0 |
| **Status** | Baseline |
| **Depends on** | SOKO-ARCH-001, SRS security NFRs |

---

## 1. Purpose

Define how SokoOS protects tenants, devices, money paths, and personal data while remaining usable offline.

---

## 2. Threat Model (Summary)

| Threat | Example | Primary controls |
| --- | --- | --- |
| Cross-tenant access | API IDOR across businesses | Tenant context from token; repo scoping; tests |
| Privilege escalation | Cashier voids without permission | RBAC guards online + offline permission material |
| Offline tampering | Edit SQLite to inflate cash | DB encryption, device binding, sync audit, reconciliation reports |
| Replay / duplicate sync | Resubmit sale envelope | Idempotent `changeId` |
| Credential stuffing | Brute force login | Rate limits, lockout policy, logging |
| Insider cover-up | Delete audit trails | Append-only audit; restricted retention roles |
| Plugin abuse | Over-broad permissions | Explicit manifests; least privilege |

---

## 3. Authentication

### 3.1 Online

- Password credentials (hashed with modern KDF, e.g. Argon2id)
- **Access JWT** (short-lived) + **Refresh token** (rotating, reusable detection)
- Claims include: `sub`, `tenant_id`, `session_id`, role/permission version, device_id when POS

### 3.2 Offline POS login

- Allowed only on **registered devices** for users previously unlocked on that device
- Store verifier material in OS keychain / encrypted store — not plaintext passwords in SQLite
- Refresh authz snapshot periodically when online
- Revocation: enforced on next successful auth sync; optional “online required” for high-risk actions (void above threshold)

### 3.3 Device registration

- Device has `device_id` (UUID), display name, branch assignment, public key/optional
- Admin can disable device → sync push rejected

---

## 4. Authorization (RBAC)

Permission key format: `domain.action` (e.g. `sales.create`, `sales.void`, `inventory.adjust`).

Evaluation order:

1. Authenticated principal  
2. Tenant match  
3. Branch scope (if applicable)  
4. Permission grant via roles  
5. Plugin enabled (for plugin permissions)

Default roles from SRS ship as seed data; tenants may clone/customize except platform-owner role.

**Offline:** POS embeds signed/hashed permission snapshot with `authzVersion`. Commands check local snapshot.

---

## 5. Audit Logging

Every mutating business action produces an append-only audit record:

- `id`, `tenant_id`, `branch_id?`, `actor_user_id`, `device_id?`
- `action`, `entity_type`, `entity_id`
- `payload_ref` / redacted before-after
- `created_at` (server or local+ack)

Business Owner cannot delete audit rows. Platform retention policies apply.

---

## 6. Data Protection

| Data | Control |
| --- | --- |
| In transit | TLS 1.2+ |
| At rest (cloud) | Volume encryption + provider controls; secrets in secret manager |
| At rest (POS) | SQLCipher or equivalent encrypted SQLite |
| PII | Minimize; permission-gate; avoid logging raw PII |
| Backups | Encrypted; tenant-aware restore procedures |

---

## 7. Application Security Controls

- Zod (client) + class-validator/Zod (server) for input validation
- Parameterized ORM queries only (Prisma)
- Rate limiting on auth and sync endpoints (Redis)
- Security headers on web surfaces
- CORS allowlists for admin origins
- File upload constraints (type/size) when attachments land

Align with OWASP ASVS Level 2 targets for online components.

---

## 8. Multi-Tenant Isolation

Defense layers:

1. JWT tenant claim immutable for session  
2. Application repositories require `tenantId` argument (typed)  
3. Integration tests attempting cross-tenant UUID access must fail  
4. Future: PostgreSQL RLS policies mirroring `tenant_id`

Platform Owner APIs are separate and audited.

---

## 9. Sync Security

See Sync Engine doc. Additional rules:

- Maximum envelope size / changes per request  
- Per-device rate limits  
- Reject tenant mismatch  
- Quarantine malformed payloads  

---

## 10. Secure Development

- Dependency scanning in CI  
- Secret scanning  
- No secrets in git  
- Code review for authz and sync paths  
- Security test suite gate on main  

---

## 11. Incident Response Hooks

- Ability to suspend tenant or device quickly  
- Sync kill-switch per tenant  
- Audit export for investigations  

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-15 | Initial security architecture |
