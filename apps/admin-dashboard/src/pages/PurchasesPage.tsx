import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney, parseMoneyToMinor } from "../lib/money";

type Line = {
  id: string;
  productId: string;
  quantity: number;
  quantityReceived: number;
  unitCostMinor: number;
  product?: { name: string; sku: string };
};

type Lpo = {
  id: string;
  lpoNumber: string | null;
  status: string;
  totalMinor: number;
  notes?: string | null;
  supplier?: { name: string; phone?: string | null } | null;
  branch?: { name: string } | null;
  items: Line[];
  createdAt?: string;
};

type Product = { id: string; name: string; sku: string; costMinor?: number | null };
type Branch = { id: string; name: string };
type Warehouse = { id: string; name: string };
type Supplier = { id: string; name: string; phone?: string | null };
type Tenant = {
  name: string;
  currency: string;
  settings?: {
    company?: { address?: string; phone?: string; email?: string; taxId?: string; logoUrl?: string };
    lpo?: { templateName?: string; footer?: string };
  };
};

function errMsg(err: unknown, fallback: string) {
  return err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : fallback;
}

export function PurchasesPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [lpos, setLpos] = useState<Lpo[]>([]);
  const [open, setOpen] = useState<Lpo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [lines, setLines] = useState<Array<{ productId: string; name: string; sku: string; quantity: number; unitCostMinor: number }>>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [recvQty, setRecvQty] = useState<Record<string, string>>({});

  const company = tenant?.settings?.company ?? {};
  const lpoTpl = tenant?.settings?.lpo ?? {};
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "—";
  const supplier = suppliers.find((s) => s.id === supplierId);
  const previewTotal = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unitCostMinor, 0),
    [lines],
  );

  async function load() {
    const [p, b, w, s, list, t] = await Promise.all([
      apiRequest<Product[] | { data: Product[] }>("/products?limit=200", { token }),
      apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
      apiRequest<Warehouse[] | { data: Warehouse[] }>("/warehouses", { token }),
      apiRequest<Supplier[] | { data: Supplier[] }>("/suppliers", { token }),
      apiRequest<Lpo[] | { data: Lpo[] }>("/purchases", { token }),
      apiRequest<Tenant>("/tenant", { token }),
    ]);
    const arr = <T,>(x: T[] | { data: T[] }) => (Array.isArray(x) ? x : x.data);
    setProducts(arr(p));
    setBranches(arr(b));
    setWarehouses(arr(w));
    setSuppliers(arr(s));
    setLpos(arr(list));
    setTenant(t);
    const firstBranch = arr(b)[0];
    const firstWarehouse = arr(w)[0];
    if (!branchId && firstBranch) setBranchId(firstBranch.id);
    if (!warehouseId && firstWarehouse) setWarehouseId(firstWarehouse.id);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(errMsg(err, "Failed to load")));
  }, [token]);

  function addLine(event: FormEvent) {
    event.preventDefault();
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: Number(qty) || 1,
        unitCostMinor: cost ? parseMoneyToMinor(cost) : product.costMinor ?? 0,
      },
    ]);
    setProductId("");
    setQty("1");
    setCost("");
  }

  async function createLpo(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await apiRequest<Lpo>("/purchases", {
        method: "POST",
        token,
        body: {
          branchId,
          supplierId: supplierId || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCostMinor: l.unitCostMinor,
          })),
        },
      });
      setLines([]);
      setNotes("");
      await load();
      setOpen(created);
    } catch (err) {
      setError(errMsg(err, "Create failed"));
    }
  }

  async function openDetail(id: string) {
    setError(null);
    try {
      setOpen(await apiRequest<Lpo>(`/purchases/${id}`, { token }));
    } catch (err) {
      setError(errMsg(err, "Failed to load LPO"));
    }
  }

  async function issue() {
    if (!open) return;
    setError(null);
    try {
      setOpen(await apiRequest<Lpo>(`/purchases/${open.id}/issue`, { method: "POST", token }));
      await load();
    } catch (err) {
      setError(errMsg(err, "Issue failed"));
    }
  }

  async function cancelLpo() {
    if (!open) return;
    if (!window.confirm(`Cancel ${open.lpoNumber}? Only allowed when nothing has been received.`)) return;
    setError(null);
    try {
      setOpen(await apiRequest<Lpo>(`/purchases/${open.id}/cancel`, { method: "POST", token }));
      await load();
    } catch (err) {
      setError(errMsg(err, "Cancel failed"));
    }
  }

  async function receive() {
    if (!open) return;
    setError(null);
    const items = open.items
      .map((line) => ({
        productId: line.productId,
        quantity: Number(recvQty[line.id] || 0),
      }))
      .filter((l) => l.quantity > 0);
    try {
      setOpen(
        await apiRequest<Lpo>(`/purchases/${open.id}/receive`, {
          method: "POST",
          token,
          body: { warehouseId, items: items.length ? items : undefined },
        }),
      );
      setRecvQty({});
      await load();
    } catch (err) {
      setError(errMsg(err, "Receive failed"));
    }
  }

  const previewLines = open
    ? open.items.map((l) => ({
        name: l.product?.name ?? l.productId,
        sku: l.product?.sku ?? "",
        quantity: l.quantity,
        unitCostMinor: l.unitCostMinor,
      }))
    : lines;
  const previewSupplier = open?.supplier?.name ?? supplier?.name ?? "Walk-in supplier";
  const previewBranch = open?.branch?.name ?? branchName;
  const previewTotalShow = open?.totalMinor ?? previewTotal;
  const previewNumber = open?.lpoNumber ?? "LPO-DRAFT";

  return (
    <AppShell
      title="LPOs / Receiving"
      description="Create a local purchase order, preview the document, then receive stock against that same LPO."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <h2 className="font-display text-xl">Create LPO</h2>
          <form onSubmit={createLpo} className="mt-3 space-y-3">
            <label className="block text-sm">
              Branch
              <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Supplier
              <select className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Walk-in supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="grid gap-2 md:grid-cols-4">
              <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                ))}
              </select>
              <Input label="Qty ordered" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Input label="Unit cost" value={cost} onChange={(e) => setCost(e.target.value)} />
              <Button type="button" variant="secondary" onClick={(e) => addLine(e)}>
                Add line
              </Button>
            </div>
            <ul className="text-sm">
              {lines.map((l, i) => (
                <li key={`${l.productId}-${i}`} className="flex items-center justify-between gap-2 py-1">
                  <span>{l.name} × {l.quantity}</span>
                  <span className="flex items-center gap-2">
                    {formatMoney(l.unitCostMinor * l.quantity, currency)}
                    <button type="button" className="text-[var(--soko-color-danger)]" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                  </span>
                </li>
              ))}
            </ul>
            <Button type="submit" disabled={!lines.length}>Save draft LPO</Button>
          </form>

          <div className="mt-8">
            <h2 className="font-display text-xl">Open LPOs</h2>
            {!lpos.length ? (
              <EmptyState title="No LPOs" body="Create a draft, issue it, then receive against the same number." />
            ) : (
              <ul className="mt-3 space-y-2">
                {lpos.map((lpo) => (
                  <li key={lpo.id}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-[var(--soko-color-border)] px-3 py-2 text-left"
                      onClick={() => void openDetail(lpo.id)}
                    >
                      <span className="font-semibold">{lpo.lpoNumber ?? "Draft"}</span>
                      <span className="ml-2 text-xs uppercase">{lpo.status}</span>
                      <span className="float-right">{formatMoney(lpo.totalMinor, currency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="lpo-preview rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-white p-6 text-black shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="" className="mb-2 h-12 object-contain" />
              ) : (
                <p className="font-display text-2xl font-bold text-[var(--soko-color-primary)]">{tenant?.name ?? "Your company"}</p>
              )}
              <p className="text-sm text-neutral-600">{company.address || "Address — set in Settings"}</p>
              <p className="text-sm text-neutral-600">
                {[company.phone, company.email].filter(Boolean).join(" · ") || "Phone / email — set in Settings"}
              </p>
              {company.taxId ? <p className="text-sm text-neutral-600">Tax ID: {company.taxId}</p> : null}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{lpoTpl.templateName || "Standard LPO template"}</p>
              <p className="font-display text-2xl font-bold">LOCAL PURCHASE ORDER</p>
              <p className="mt-1 font-mono text-sm">{previewNumber}</p>
              <p className="text-xs text-neutral-500">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500">Supplier</p>
              <p className="font-semibold">{previewSupplier}</p>
              {supplier?.phone || open?.supplier?.phone ? (
                <p className="text-neutral-600">{open?.supplier?.phone ?? supplier?.phone}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500">Deliver to</p>
              <p className="font-semibold">{previewBranch}</p>
              <p className="text-neutral-600">{tenant?.name}</p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500">
                <th className="py-2">Item</th>
                <th>SKU</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {previewLines.length ? (
                previewLines.map((l, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2">{l.name}</td>
                    <td className="text-neutral-500">{"sku" in l ? l.sku : ""}</td>
                    <td className="text-right">{l.quantity}</td>
                    <td className="text-right">{formatMoney(l.unitCostMinor, currency)}</td>
                    <td className="text-right">{formatMoney(l.quantity * l.unitCostMinor, currency)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral-400">
                    Add lines on the left — preview updates live
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="min-w-[180px] text-sm">
              <div className="flex justify-between border-t border-neutral-300 pt-2 font-bold">
                <span>Total</span>
                <span>{formatMoney(previewTotalShow, currency)}</span>
              </div>
            </div>
          </div>

          {(notes || open?.notes || lpoTpl.footer) ? (
            <p className="mt-6 text-xs text-neutral-600">{open?.notes || notes || lpoTpl.footer}</p>
          ) : (
            <p className="mt-6 text-xs text-neutral-400">Footer / terms — configure under Settings → LPO template</p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-neutral-500">
            <div>
              <p className="border-b border-neutral-300 pb-8">Authorized by</p>
            </div>
            <div>
              <p className="border-b border-neutral-300 pb-8">Supplier acknowledgement</p>
            </div>
          </div>
        </section>
      </div>

      {open ? (
        <section className="mt-8 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{open.lpoNumber}</h2>
              <p className="text-sm text-[var(--soko-color-text-muted)]">
                {open.supplier?.name ?? "No supplier"} · {open.status} · receive against this same document
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {open.status === "draft" ? <Button onClick={() => void issue()}>Issue LPO</Button> : null}
              {open.status === "draft" || open.status === "issued" ? (
                <Button variant="secondary" onClick={() => void cancelLpo()}>Cancel LPO</Button>
              ) : null}
              <Button variant="secondary" onClick={() => window.print()}>Print preview</Button>
            </div>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--soko-color-text-muted)]">
                <th className="py-2">Product</th>
                <th>Ordered</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Receive now</th>
              </tr>
            </thead>
            <tbody>
              {open.items.map((line) => {
                const remaining = line.quantity - line.quantityReceived;
                return (
                  <tr key={line.id} className="border-t border-[var(--soko-color-border)]">
                    <td className="py-2">{line.product?.name ?? line.productId}</td>
                    <td>{line.quantity}</td>
                    <td>{line.quantityReceived}</td>
                    <td>{remaining}</td>
                    <td>
                      <input
                        className="w-20 rounded border border-[var(--soko-color-border)] bg-transparent px-2 py-1"
                        value={recvQty[line.id] ?? ""}
                        placeholder={String(remaining)}
                        onChange={(e) => setRecvQty((m) => ({ ...m, [line.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {open.status === "issued" || open.status === "partial" ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Warehouse
                <select className="mt-1 block rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
              <Button onClick={() => void receive()}>Receive against this LPO</Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
