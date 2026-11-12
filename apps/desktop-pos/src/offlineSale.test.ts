import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryLocalDb } from "./db/MemoryLocalDb.ts";
import { SEED_PRODUCTS } from "./db/seed.ts";
import { cartTotals, formatMoney } from "./stores/cart.ts";

test("formatMoney and cart totals", () => {
  assert.equal(formatMoney(8500), "KES 85.00");
  const totals = cartTotals([
    { productId: "a", sku: "A", name: "A", unitPriceCents: 1000, qty: 2 },
    { productId: "b", sku: "B", name: "B", unitPriceCents: 500, qty: 1 },
  ]);
  assert.equal(totals.totalCents, 2500);
});

test("completeSale writes sale, stock movement, and outbox without network", async () => {
  const db = new MemoryLocalDb();
  await db.upsertProducts(SEED_PRODUCTS.slice(0, 2));
  const before = await db.getProduct("prod_rice");
  assert.ok(before);

  const sale = await db.completeSale({
    branchId: crypto.randomUUID(),
    warehouseId: crypto.randomUUID(),
    tender: "cash",
    cashTenderedCents: 10_000,
    lines: [{ productId: "prod_rice", qty: 2 }],
  });

  assert.equal(sale.lines.length, 1);
  assert.equal(sale.synced, false);
  assert.match(sale.id, /^[0-9a-f-]{36}$/i);

  const after = await db.getProduct("prod_rice");
  assert.equal(after?.stock, (before?.stock ?? 0) - 2);

  const movements = await db.listStockMovements();
  assert.equal(movements.length, 1);
  assert.equal(movements[0]?.delta, -2);

  const outbox = await db.listOutbox();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.entityType, "sale");
  assert.equal(outbox[0]?.entityId, sale.id);
  const payload = outbox[0]?.payload as { items: unknown[]; payments: unknown[] };
  assert.ok(Array.isArray(payload.items) && payload.items.length === 1);
  assert.ok(Array.isArray(payload.payments) && payload.payments.length === 1);
});
