# @sokoos/plugin-pharmacy

First-party **pharmacy** plugin stub for SokoOS. Ships contracts only: manifest, permissions (batches/expiry), settings schema, sync entity names, and menu contributions. No Nest module wiring into `services/api` — that keeps core untouched (**REQ-PLG-***, ADR-005).

## Package

| Field | Value |
| --- | --- |
| Name | `@sokoos/plugin-pharmacy` |
| Plugin id | `soko.plugin.pharmacy` |
| SDK | `@sokoos/plugin-sdk` `PluginManifest` / `PluginModule` |

## How registration works (no core forks)

1. Host loads plugin packages from a registry index (bundler-discovered list or config).
2. Host calls `validateManifest(plugin.manifest)` and refuses unsupported `apiVersion`.
3. Host invokes optional hooks — `registerPermissions`, `registerMenus`, `registerSettings`, `registerSyncEntities`, etc.
4. Namespaced data (`pharmacy.*` permissions, `pharmacy.batch` sync entities) never alters core tables.

Example host bootstrap (illustrative — not wired yet):

```ts
import { pharmacyPlugin } from "@sokoos/plugin-pharmacy";
import { validateManifest } from "@sokoos/plugin-sdk";

const plugins = [pharmacyPlugin]; // discovered registry

for (const plugin of plugins) {
  validateManifest(plugin.manifest);
  const ctx = { pluginId: plugin.manifest.id };
  await plugin.registerPermissions?.(ctx);
  await plugin.registerSyncEntities?.(ctx);
  // Later: mount registerRoutes into Nest RouterModule without editing SalesModule
}
```

## Permissions

| Key | Purpose |
| --- | --- |
| `pharmacy.batches.read` | View lots / batches |
| `pharmacy.batches.write` | Create / adjust batches |
| `pharmacy.expiry.read` | Near-expiry reports |
| `pharmacy.expiry.manage` | Quarantine / dispose expired stock |

## Sync entities

| `entityType` | Strategy |
| --- | --- |
| `pharmacy.batch` | upsert |
| `pharmacy.batch_movement` | append |
| `pharmacy.expiry_event` | append |

## Settings schema stub

Zod object: `requireBatchOnSale`, `warnDaysBeforeExpiry`, `blockExpiredSale`, `defaultNearExpirySort`. Host validates tenant settings against `manifest.settingsSchema` at enable time.

## Develop

```bash
pnpm --filter @sokoos/plugin-pharmacy typecheck
pnpm --filter @sokoos/plugin-pharmacy test
pnpm --filter @sokoos/plugin-pharmacy build
```
