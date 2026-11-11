import { FormEvent, useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Branch = { id: string; name: string };
type Product = { id: string; name: string; sku: string; priceMinor: number };
type Table = {
  id: string;
  code: string;
  label?: string | null;
  section?: string | null;
  status: string;
  seats: number;
  currentSaleId?: string | null;
  openCheck?: {
    id: string;
    totalMinor: number;
    checkStatus?: string | null;
    items?: Array<{ id: string; nameSnapshot: string; quantity: number; lineTotalMinor: number }>;
  } | null;
};

export function RestaurantFloorPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Table | null>(null);
  const [seed, setSeed] = useState("T1,T2,T3,T4");
  const [section, setSection] = useState("Main");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function loadFloor(bid = branchId) {
    if (!bid) return;
    const floor = await apiRequest<{ tables: Table[] }>(`/dining/floor?branchId=${bid}`, { token });
    setTables(floor.tables ?? []);
    if (selected) {
      const next = floor.tables.find((t) => t.id === selected.id) ?? null;
      setSelected(next);
    }
  }

  useEffect(() => {
    void (async () => {
      const [br, prods] = await Promise.all([
        apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
        apiRequest<Product[] | { data: Product[] }>("/products", { token }),
      ]);
      const list = Array.isArray(br) ? br : br.data ?? [];
      setBranches(list);
      setProducts(Array.isArray(prods) ? prods : prods.data ?? []);
      if (list[0]) {
        setBranchId(list[0].id);
        await loadFloor(list[0].id);
      }
    })().catch((e: Error) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (branchId) void loadFloor(branchId).catch((e: Error) => setError(e.message));
  }, [branchId]);

  async function seedTables(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const codes = seed.split(",").map((c) => c.trim()).filter(Boolean);
    await apiRequest("/dining/tables", {
      method: "POST",
      token,
      body: {
        branchId,
        tables: codes.map((code, i) => ({ code, label: code, section, sortOrder: i })),
      },
    });
    setInfo("Tables saved");
    await loadFloor();
  }

  async function openCheck(table: Table) {
    setError(null);
    const sale = await apiRequest<{ id: string }>("/dining/checks", {
      method: "POST",
      token,
      body: { branchId, tableId: table.id },
    });
    setInfo(`Opened check ${sale.id.slice(0, 8)}`);
    await loadFloor();
  }

  async function addItem() {
    if (!selected?.openCheck || !productId) return;
    await apiRequest(`/dining/checks/${selected.openCheck.id}/items`, {
      method: "POST",
      token,
      body: { items: [{ productId, quantity: Number(qty) || 1 }] },
    });
    setInfo("Item added");
    await loadFloor();
  }

  async function sendKitchen() {
    if (!selected?.openCheck) return;
    await apiRequest(`/dining/checks/${selected.openCheck.id}/send-kitchen`, { method: "POST", token });
    setInfo("Sent to kitchen");
    await loadFloor();
  }

  async function closeCash() {
    if (!selected?.openCheck) return;
    const total = selected.openCheck.totalMinor;
    await apiRequest(`/dining/checks/${selected.openCheck.id}/close`, {
      method: "POST",
      token,
      body: { payments: [{ method: "cash", amountMinor: total }] },
    });
    setInfo("Check closed — table dirty for reset");
    await loadFloor();
  }

  async function transferTo(toTableId: string) {
    if (!selected?.openCheck) return;
    await apiRequest(`/dining/checks/${selected.openCheck.id}/transfer`, {
      method: "POST",
      token,
      body: { toTableId },
    });
    setInfo("Transferred");
    await loadFloor();
  }

  async function splitFirstItem() {
    const item = selected?.openCheck?.items?.[0];
    if (!selected?.openCheck || !item) return;
    await apiRequest(`/dining/checks/${selected.openCheck.id}/split`, {
      method: "POST",
      token,
      body: { items: [{ saleItemId: item.id, quantity: 1 }] },
    });
    setInfo("Split created (no extra revenue)");
    await loadFloor();
  }

  async function markFree(table: Table) {
    await apiRequest(`/dining/tables/${table.id}/status`, {
      method: "PATCH",
      token,
      body: { status: "free" },
    });
    await loadFloor();
  }

  return (
    <AppShell title="Restaurant floor" description="Tables, sections, open checks, kitchen send, transfer, split, and close — inventory deducts once on close.">
      {error ? <p className="mb-2 text-sm text-[var(--soko-color-danger)]" role="alert">{error}</p> : null}
      {info ? <p className="mb-2 text-sm text-emerald-700" role="status">{info}</p> : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Branch</span>
          <select
            className="rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={() => void loadFloor()}>Refresh</Button>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--soko-color-border)] p-3" onSubmit={(e) => void seedTables(e)}>
        <Input label="Section" value={section} onChange={(e) => setSection(e.target.value)} />
        <Input label="Table codes (comma)" value={seed} onChange={(e) => setSeed(e.target.value)} />
        <Button type="submit">Save tables</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-lg border p-3 text-left focus:outline focus:outline-2 focus:outline-[var(--soko-color-primary)] ${
                selected?.id === t.id ? "border-[var(--soko-color-primary)]" : "border-[var(--soko-color-border)]"
              }`}
              onClick={() => setSelected(t)}
            >
              <p className="font-semibold">{t.label ?? t.code}</p>
              <p className="text-xs text-[var(--soko-color-text-muted)]">{t.section ?? "Main"} · {t.status}</p>
              {t.openCheck ? (
                <p className="mt-1 text-sm">Check {t.openCheck.totalMinor} · {t.openCheck.checkStatus}</p>
              ) : null}
            </button>
          ))}
          {!tables.length ? <p className="text-sm text-[var(--soko-color-text-muted)]">No tables — seed codes above.</p> : null}
        </div>

        <div className="space-y-3 rounded-lg border border-[var(--soko-color-border)] p-4">
          {!selected ? <p className="text-sm text-[var(--soko-color-text-muted)]">Select a table</p> : (
            <>
              <p className="font-semibold">{selected.label ?? selected.code}</p>
              {selected.status === "free" || selected.status === "dirty" || selected.status === "reserved" ? (
                <Button type="button" onClick={() => void openCheck(selected).catch((e: Error) => setError(e.message))}>
                  Open check
                </Button>
              ) : null}
              {selected.status === "dirty" ? (
                <Button type="button" variant="secondary" onClick={() => void markFree(selected)}>Mark free</Button>
              ) : null}
              {selected.openCheck ? (
                <>
                  <ul className="text-sm">
                    {(selected.openCheck.items ?? []).map((i) => (
                      <li key={i.id}>{i.quantity}× {i.nameSnapshot} · {i.lineTotalMinor}</li>
                    ))}
                  </ul>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Add item</span>
                    <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-2 py-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
                      <option value="">Select…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <Input label="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void addItem().catch((e: Error) => setError(e.message))}>Add</Button>
                    <Button type="button" variant="secondary" onClick={() => void sendKitchen().catch((e: Error) => setError(e.message))}>Send kitchen</Button>
                    <Button type="button" variant="secondary" onClick={() => void splitFirstItem().catch((e: Error) => setError(e.message))}>Split 1st item</Button>
                    <Button type="button" onClick={() => void closeCash().catch((e: Error) => setError(e.message))}>Close cash</Button>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Transfer to</span>
                    <select
                      className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-2 py-2"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) void transferTo(e.target.value).catch((err: Error) => setError(err.message));
                      }}
                    >
                      <option value="">Select free table…</option>
                      {tables.filter((t) => t.id !== selected.id && t.status === "free").map((t) => (
                        <option key={t.id} value={t.id}>{t.code}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
