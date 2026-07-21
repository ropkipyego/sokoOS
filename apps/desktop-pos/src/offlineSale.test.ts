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
    branchId: "branch_1",
    tender: "cash",
    lines: [{ productId: "prod_rice", qty: 2 }],
  });

  assert.equal(sale.lines.length, 1);
  assert.equal(sale.synced, false);

  const after = await db.getProduct("prod_rice");
  assert.equal(after?.stock, (before?.stock ?? 0) - 2);

  const movements = await db.listStockMovements();
  assert.equal(movements.length, 1);
  assert.equal(movements[0]?.delta, -2);

  const outbox = await db.listOutbox();
  assert.ok(outbox.some((item) => item.entityType === "sale"));
  assert.ok(outbox.some((item) => item.entityType === "stock_movement"));
});
