import { useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Dept = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  branchId?: string | null;
  branch?: { name: string; code: string } | null;
  _count?: { members: number; devices: number };
};

type Branch = { id: string; name: string; code: string };
type Product = { id: string; sku: string; name: string; priceMinor: number; itemType?: string };
type Offer = {
  id: string;
  productId: string;
  priceMinor?: number | null;
  available: boolean;
  product?: Product;
};

export function DepartmentsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<Dept[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState({ code: "", name: "", type: "retail", branchId: "" });
  const [offerForm, setOfferForm] = useState({ productId: "", priceOverride: "" });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [deps, br, prods] = await Promise.all([
      apiRequest<Dept[]>("/departments", { token }),
      apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
      apiRequest<Product[] | { data: Product[] }>("/products", { token }),
    ]);
    setRows(Array.isArray(deps) ? deps : []);
    setBranches(Array.isArray(br) ? br : br.data);
    setProducts(Array.isArray(prods) ? prods : prods.data ?? []);
  }

  async function loadOffers(departmentId: string) {
    const list = await apiRequest<Offer[]>(`/departments/${departmentId}/products`, { token });
    setOffers(Array.isArray(list) ? list : []);
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setOffers([]);
      return;
    }
    void loadOffers(selectedId).catch((e: Error) => setError(e.message));
  }, [selectedId, token]);

  async function create() {
    setError(null);
    try {
      await apiRequest("/departments", {
        method: "POST",
        token,
        body: {
          code: form.code,
          name: form.name,
          type: form.type,
          branchId: form.branchId || undefined,
        },
      });
      setForm({ code: "", name: "", type: "retail", branchId: form.branchId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function addOffer() {
    if (!selectedId || !offerForm.productId) return;
    setError(null);
    try {
      await apiRequest(`/departments/${selectedId}/products`, {
        method: "POST",
        token,
        body: {
          productId: offerForm.productId,
          priceMinor: offerForm.priceOverride
            ? Math.round(Number(offerForm.priceOverride) * 100)
            : undefined,
          available: true,
        },
      });
      setOfferForm({ productId: "", priceOverride: "" });
      await loadOffers(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Offer failed");
    }
  }

  async function removeOffer(productId: string) {
    if (!selectedId) return;
    await apiRequest(`/departments/${selectedId}/products/${productId}`, { method: "DELETE", token });
    await loadOffers(selectedId);
  }

  const selected = rows.find((d) => d.id === selectedId) ?? null;

  return (
    <AppShell title="Departments" description="Operational units inside this business — restaurant, bar, spa, grocery, etc. Not separate tenants.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mt-4 grid max-w-3xl gap-2 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4 sm:grid-cols-2">
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <label className="text-sm">
          <span className="mb-1 block font-medium">Branch</span>
          <select
            className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </label>
        <Button className="sm:col-span-2" onClick={() => void create()}>Create department</Button>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-[var(--soko-color-text-muted)]">
            <th className="py-2">Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Branch</th>
            <th>Members</th>
            <th>Devices</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-[var(--soko-color-border)]">
              <td className="py-2 font-mono text-xs">{d.code}</td>
              <td>{d.name}</td>
              <td className="capitalize">{d.type}</td>
              <td>{d.branch?.name ?? "—"}</td>
              <td>{d._count?.members ?? 0}</td>
              <td>{d._count?.devices ?? 0}</td>
              <td>{d.status}</td>
              <td>
                <button
                  type="button"
                  className="text-[var(--soko-color-primary)]"
                  onClick={() => setSelectedId(d.id)}
                >
                  Offers
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected ? (
        <div className="mt-8 max-w-3xl rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <h3 className="font-semibold">Product offers — {selected.name}</h3>
          <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">
            Department-specific catalogue and optional price overrides.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Product</span>
              <select
                className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
                value={offerForm.productId}
                onChange={(e) => setOfferForm({ ...offerForm, productId: e.target.value })}
              >
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} ({p.itemType ?? "stock"})
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Price override"
              value={offerForm.priceOverride}
              onChange={(e) => setOfferForm({ ...offerForm, priceOverride: e.target.value })}
              placeholder="optional"
            />
            <Button className="sm:col-span-3" onClick={() => void addOffer()}>
              Add offer
            </Button>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {offers.map((o) => (
              <li key={o.id} className="flex items-center justify-between border-t border-[var(--soko-color-border)] pt-2">
                <span>
                  {o.product?.sku ?? o.productId} — {o.product?.name ?? "Product"}
                  {o.priceMinor != null ? ` · override ${o.priceMinor}` : ""}
                </span>
                <button type="button" className="text-[var(--soko-color-danger)]" onClick={() => void removeOffer(o.productId)}>
                  Remove
                </button>
              </li>
            ))}
            {!offers.length ? <li className="text-[var(--soko-color-text-muted)]">No offers yet.</li> : null}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
