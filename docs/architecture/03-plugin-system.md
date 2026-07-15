# SokoOS — Plugin System Architecture

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-ARCH-003 |
| **Version** | 1.0.0 |
| **Status** | Baseline (contracts) |
| **Depends on** | SOKO-ARCH-001, REQ-PLG-* |

---

## 1. Purpose

Enable industry-specific capabilities (restaurant, pharmacy, salon, etc.) to extend SokoOS **without modifying core modules**.

This document defines contracts only. First industry plugin implementations come later.

---

## 2. Goals and Non-Goals

### Goals

- Stable extension points: routes, migrations, permissions, menus, reports, jobs, settings
- Per-tenant install/enable
- Isolation of failures (plugin error must not corrupt core sale commit)
- Clear ownership of data namespaces

### Non-Goals (v1)

- Public third-party marketplace billing
- In-process untrusted community code execution without review
- Hot-swap plugins without process restart (nice-to-have later)

---

## 3. Approaches Compared

| Approach | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Fork core per industry | Fast demos | Unmaintainable | Reject |
| If/else industry flags in core | Simple | Core becomes unreadable | Reject |
| **Manifest + SDK registration** | Clean, testable | Requires discipline | **Recommend** |
| Micro-frontends + remote engines | Max isolation | Heavy ops | Defer |

---

## 4. Plugin Package Shape

```text
plugins/
  pharmacy/
    package.json
    manifest.ts
    src/
      permissions.ts
      settings.ts
      api/          # Nest route registrars
      web/          # Admin route/menu contributions
      pos/          # POS extensions (panels, validators)
      jobs/
      reports/
      db/           # Prisma/SQL migrations namespaced
```

Core monorepo may host first-party plugins under `plugins/`. Later, external packages implement the same SDK interface.

---

## 5. Manifest Contract

```ts
type PluginManifest = {
  id: string;                 // "soko.plugin.pharmacy"
  name: string;
  version: string;            // semver
  apiVersion: 1;              // SDK compatibility
  description?: string;
  permissions: PermissionDef[];
  settingsSchema?: ZodSchema | JsonSchema;
  capabilities: {
    apiRoutes?: boolean;
    adminMenus?: boolean;
    posExtensions?: boolean;
    migrations?: boolean;
    reports?: boolean;
    jobs?: boolean;
  };
  dependsOn?: string[];       // other plugin ids
};
```

Host refuses to load plugins with unsupported `apiVersion`.

---

## 6. Extension Points

### 6.1 Permissions

Plugins declare permissions; core RBAC stores and evaluates them like core permissions.

```ts
{ key: "pharmacy.dispense", description: "Dispense controlled items", category: "pharmacy" }
```

Tenant roles grant plugin permissions only when plugin is enabled for tenant.

### 6.2 Database migrations

- Namespace: `plugin_<id>_*` tables / columns only.
- Plugins **must not** alter core tables except via approved **extension columns registry** (optional JSON `extensions` payload on core entities — preferred over ALTER of core).

**Recommended pattern:** core entities expose `extensions JsonB` (tenant-safe) for rare soft extensions; structured plugin data lives in plugin tables keyed by `tenant_id` + core `uuid` references.

### 6.3 API routes

```ts
registerApi(router: PluginRouter): void
```

Routes mounted under `/v1/plugins/:pluginId/...` or host-assigned prefix. Guards still enforce authn/authz/tenant.

### 6.4 Admin menus & routes

```ts
registerAdminNav(contrib: { id, label, href, icon?, permission? }): void
registerAdminRoutes(routes): void
```

### 6.5 POS extensions

Constrained hooks only (prevent checkout clutter):

| Hook | Use |
| --- | --- |
| `pos.cart.validate` | Extra validation before pay |
| `pos.cart.line.augment` | Add required line metadata (e.g., batch) |
| `pos.payment.afterCommit` | Post-sale plugin records (must be local-tx safe) |
| `pos.panel.register` | Optional side panel (not in hero clutter) |

Plugins may **not** replace the one-screen checkout layout.

### 6.6 Reports

```ts
registerReport({ id, title, permission, runner }): void
```

### 6.7 Background jobs

```ts
registerJob({ name, queue, handler, schedule? }): void
```

Jobs run in worker process; must be tenant-aware.

### 6.8 Settings

Plugin settings stored under `tenant_settings.plugins[pluginId]` validated by plugin schema.

---

## 7. Lifecycle

```text
Discover manifests
  → Compatibility check
  → Run pending plugin migrations (install/upgrade)
  → Register permissions
  → Register routes/menus/jobs/reports
  → Enable per tenant (entitlement flag)
```

Disable plugin: hide menus/routes; retain data; block new writes requiring plugin permissions.

---

## 8. Sync Implications

Plugin entities that must work offline:

- Declare sync entity types in manifest: `syncEntities: ["pharmacy_batch", ...]`
- Provide Zod schemas to `packages/sync-protocol`
- Follow append/upsert rules from Sync Engine doc
- Use namespaced `entityType` strings: `pharmacy.batch`

Core sync worker dispatches to registered handlers; unknown entity types from disabled plugins are quarantined, not dropped silently.

---

## 9. Security Model

| Control | Rule |
| --- | --- |
| Trust | v1 first-party plugins only (code review) |
| Permissions | Explicit grant; no implicit admin |
| Data | Plugin tables include `tenant_id`; repositories tenant-scoped |
| Failure isolation | Plugin hook errors caught; core sale commit fails closed only if hook is in `validate` path and returns hard fail |
| Audit | Plugin mutating APIs still emit audit events |

Future marketplace: signed packages, capability prompts, sandboxed runtimes (out of scope now).

---

## 10. Example: Pharmacy (illustrative)

Adds:

- Batch/lot + expiry tables  
- POS line augment (require batch on sell)  
- Report: near-expiry stock  
- Permission: `pharmacy.manage_batches`  

Does **not** fork sales tables; references `sale_item.uuid`.

---

## 11. Testing Strategy

- Contract tests: manifest validation, route registration  
- Isolation tests: disable plugin → routes 404 / menus hidden  
- Migration tests: upgrade/downgrade safety  
- POS hook tests: validation failure blocks pay; success path unchanged for core  
- Sync tests: plugin entity round-trip  

---

## 12. Core Stability Rule

**Definition of done for extensibility:** a new first-party plugin can be added as a new package + manifest registration entry **without editing** files under core domain modules (`sales`, `inventory`, `catalog`, etc.), aside from a single generated/registry index if required by the bundler (ADR-005).

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-15 | Initial plugin contracts |
