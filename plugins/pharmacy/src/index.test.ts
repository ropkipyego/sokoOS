import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pharmacyManifest, pharmacyPlugin, pharmacySettingsSchema } from "./index.js";
import { validateManifest } from "@sokoos/plugin-sdk";

describe("@sokoos/plugin-pharmacy", () => {
  it("exposes a valid PluginManifest", () => {
    const m = validateManifest(pharmacyManifest);
    assert.equal(m.id, "soko.plugin.pharmacy");
    assert.equal(m.apiVersion, 1);
    assert.ok(m.permissions.some((p) => p.key === "pharmacy.batches.write"));
    assert.ok(m.permissions.some((p) => p.key === "pharmacy.expiry.manage"));
  });

  it("registers sync entity names without core edits", async () => {
    const entities = await pharmacyPlugin.registerSyncEntities?.({
      pluginId: pharmacyManifest.id,
    });
    assert.ok(entities?.some((e) => e.entityType === "pharmacy.batch"));
    assert.ok(entities?.some((e) => e.entityType === "pharmacy.batch_movement"));
  });

  it("parses settings schema stub", () => {
    const parsed = pharmacySettingsSchema.parse({});
    assert.equal(parsed.requireBatchOnSale, true);
    assert.equal(parsed.warnDaysBeforeExpiry, 90);
  });
});
