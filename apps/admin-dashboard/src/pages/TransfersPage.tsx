import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Warehouse = { id: string; name: string; branchId: string };
type Product = { id: string; name: string; sku: string };
type Branch = { id: string; name: string };

export function TransfersPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [fromWarehouseId, setFrom] = useState("");
  const [toWarehouseId, setTo] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [w, p, b] = await Promise.all([
        apiRequest<Warehouse[] | { data: Warehouse[] }>("/warehouses", { token }),
        apiRequest<Product[] | { data: Product[] }>("/products?limit=200", { token }),
        apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
      ]);
      const arr = <T,>(x: T[] | { data: T[] }) => (Array.isArray(x) ? x : x.data);
      setWarehouses(arr(w));
      setProducts(arr(p));
      setBranches(arr(b));
      const first = arr(b)[0];
      if (first) setBranchId(first.id);
    })().catch((err: { message?: string }) => setError(err.message ?? "Load failed"));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/stock/transfers", {
        method: "POST",
        token,
        body: {
          fromWarehouseId,
          toWarehouseId,
          productId,
          branchId,
          quantity: Number(quantity),
          reason: reason || undefined,
        },
      });
      setMessage("Transfer posted — TRANSFER_OUT and TRANSFER_IN share one correlation id.");
      setQuantity("1");
      setReason("");
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Transfer failed");
    }
  }

  const branchWarehouses = warehouses.filter((w) => !branchId || w.branchId === branchId);

  return (
    <AppShell
      title="Stock transfers"
      description="Moves stock between warehouses without creating or destroying inventory. Movements are append-only."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-[var(--soko-color-success)]">{message}</p> : null}
      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
        <label className="block text-sm">
          Branch
          <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          From warehouse
          <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={fromWarehouseId} onChange={(e) => setFrom(e.target.value)} required>
            <option value="">Select</option>
            {branchWarehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          To warehouse
          <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={toWarehouseId} onChange={(e) => setTo(e.target.value)} required>
            <option value="">Select</option>
            {branchWarehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Product
          <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Select</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
            ))}
          </select>
        </label>
        <Input label="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" disabled={!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId}>
          Post transfer
        </Button>
      </form>
    </AppShell>
  );
}
