import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Balance = { warehouseId: string; productId: string; quantity: number };
type Product = { id: string; sku: string; name: string; minStockQty: number };
type Warehouse = { id: string; name: string; branchId: string };
type Movement = { id: string; type: string; quantityDelta: number; createdAt: string; productId: string; reason?: string | null };

export function InventoryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("adjustment");

  async function load() {
    const [b, p, w] = await Promise.all([
      apiRequest<{ data: Balance[] } | Balance[]>("/stock/balances?limit=200", { token }),
      apiRequest<{ data: Product[] } | Product[]>("/products?limit=200", { token }),
      apiRequest<{ data: Warehouse[] } | Warehouse[]>("/warehouses", { token }),
    ]);
    const arr = <T,>(x: T[] | { data: T[] }) => (Array.isArray(x) ? x : x.data);
    setBalances(arr(b));
    setProducts(arr(p));
    setWarehouses(arr(w));
    const firstWarehouse = arr(w)[0];
    if (!warehouseId && firstWarehouse) setWarehouseId(firstWarehouse.id);
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [token]);

  async function adjust(event: FormEvent) {
    event.preventDefault();
    const wh = warehouses.find((w) => w.id === warehouseId);
    await apiRequest("/stock/movements", {
      method: "POST",
      token,
      body: {
        warehouseId,
        productId,
        branchId: wh?.branchId,
        type: Number(delta) < 0 ? "damage" : "adjustment",
        quantityDelta: Number(delta),
        reason,
      },
    });
    await load();
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  return (
    <AppShell title="Stock overview" description="Balances are projections of append-only movements. Adjustments never overwrite history.">
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={adjust} className="mb-6 grid gap-3 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4 md:grid-cols-5">
        <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku}</option>)}
        </select>
        <Input label="Qty delta" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit">Post movement</Button>
      </form>
      {!balances.length ? (
        <EmptyState title="No balances" body="Receive an LPO or post an opening adjustment." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--soko-color-text-muted)]">
              <th className="py-2">Product</th>
              <th>Warehouse</th>
              <th>Qty</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const p = productMap.get(b.productId);
              const low = b.quantity <= (p?.minStockQty || 5);
              return (
                <tr key={`${b.warehouseId}-${b.productId}`} className="border-t border-[var(--soko-color-border)]">
                  <td className="py-2">{p?.name ?? b.productId}</td>
                  <td>{warehouseMap.get(b.warehouseId)?.name ?? b.warehouseId}</td>
                  <td>{b.quantity}</td>
                  <td>{b.quantity <= 0 ? "OUT" : low ? "LOW" : "OK"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}

export function MovementsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<Movement[]>([]);
  useEffect(() => {
    void apiRequest<{ data: Movement[] } | Movement[]>("/stock/movements?limit=100", { token }).then((r) => {
      setRows(Array.isArray(r) ? r : r.data);
    });
  }, [token]);
  return (
    <AppShell title="Stock movements" description="Immutable audit trail. Sales, purchases, transfers, damage, counts.">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--soko-color-text-muted)]">
            <th className="py-2">When</th>
            <th>Type</th>
            <th>Delta</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-[var(--soko-color-border)]">
              <td className="py-2">{new Date(m.createdAt).toLocaleString()}</td>
              <td>{m.type}</td>
              <td>{m.quantityDelta}</td>
              <td>{m.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
