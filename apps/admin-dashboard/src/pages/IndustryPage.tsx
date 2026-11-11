import { FormEvent, useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Product = { id: string; sku: string; name: string; priceMinor: number };
type Batch = {
  id: string;
  batchNumber: string;
  expiryDate?: string | null;
  quantityOnHand: number;
  status: string;
  product?: { sku: string; name: string };
};
type Rx = {
  id: string;
  patientName: string;
  status: string;
  prescriber?: string | null;
  items?: Array<{ quantity: number; product?: { sku: string; name: string } }>;
};
type PriceList = { id: string; code: string; name: string; _count?: { items: number; customers: number } };
type Job = { id: string; title: string; status: string; priority: number };
type Branch = { id: string; name: string };

export function IndustryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<"pharmacy" | "wholesale" | "services" | "hardware">("pharmacy");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rxs, setRxs] = useState<Rx[]>([]);
  const [lists, setLists] = useState<PriceList[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [serials, setSerials] = useState<Array<{ id: string; serialNumber: string; status: string; product?: { sku: string; name: string }; warrantyEndsAt?: string | null }>>([]);
  const [batchForm, setBatchForm] = useState({ productId: "", batchNumber: "", expiryDate: "", qty: "0" });
  const [rxForm, setRxForm] = useState({ patientName: "", productId: "", quantity: "1", dosage: "" });
  const [listForm, setListForm] = useState({ code: "", name: "" });
  const [tierForm, setTierForm] = useState({ priceListId: "", productId: "", price: "", minQty: "1" });
  const [jobForm, setJobForm] = useState({ branchId: "", title: "", description: "" });
  const [serialForm, setSerialForm] = useState({ productId: "", serialNumber: "", warrantyMonths: "12" });

  async function load() {
    const [prods, br, bat, rx, pl, jb, ser] = await Promise.all([
      apiRequest<Product[] | { data: Product[] }>("/products", { token }),
      apiRequest<Branch[] | { data: Branch[] }>("/branches", { token }),
      apiRequest<Batch[]>("/pharmacy/batches", { token }).catch(() => []),
      apiRequest<Rx[]>("/pharmacy/prescriptions", { token }).catch(() => []),
      apiRequest<PriceList[]>("/wholesale/price-lists", { token }).catch(() => []),
      apiRequest<Job[]>("/services/jobs", { token }).catch(() => []),
      apiRequest<typeof serials>("/hardware/serials", { token }).catch(() => []),
    ]);
    setProducts(Array.isArray(prods) ? prods : prods.data ?? []);
    setBranches(Array.isArray(br) ? br : br.data ?? []);
    setBatches(Array.isArray(bat) ? bat : []);
    setRxs(Array.isArray(rx) ? rx : []);
    setLists(Array.isArray(pl) ? pl : []);
    setJobs(Array.isArray(jb) ? jb : []);
    setSerials(Array.isArray(ser) ? ser : []);
    if (!jobForm.branchId) {
      const first = Array.isArray(br) ? br[0] : br.data?.[0];
      if (first) setJobForm((f) => ({ ...f, branchId: first.id }));
    }
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [token]);

  async function createBatch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/pharmacy/batches", {
        method: "POST",
        token,
        body: {
          productId: batchForm.productId,
          batchNumber: batchForm.batchNumber,
          expiryDate: batchForm.expiryDate || undefined,
          quantityOnHand: Number(batchForm.qty || 0),
        },
      });
      setBatchForm({ productId: "", batchNumber: "", expiryDate: "", qty: "0" });
      setInfo("Batch registered");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    }
  }

  async function createRx(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/pharmacy/prescriptions", {
        method: "POST",
        token,
        body: {
          patientName: rxForm.patientName,
          items: [
            {
              productId: rxForm.productId,
              quantity: Number(rxForm.quantity),
              dosage: rxForm.dosage || undefined,
            },
          ],
        },
      });
      setRxForm({ patientName: "", productId: "", quantity: "1", dosage: "" });
      setInfo("Prescription saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rx failed");
    }
  }

  async function dispense(id: string) {
    setError(null);
    try {
      await apiRequest(`/pharmacy/prescriptions/${id}/dispense`, { method: "POST", token, body: {} });
      setInfo("Dispensed (FEFO batch allocated when available)");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispense failed");
    }
  }

  async function createList(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/wholesale/price-lists", { method: "POST", token, body: listForm });
    setListForm({ code: "", name: "" });
    await load();
  }

  async function addTier(e: FormEvent) {
    e.preventDefault();
    await apiRequest(`/wholesale/price-lists/${tierForm.priceListId}/items`, {
      method: "POST",
      token,
      body: {
        productId: tierForm.productId,
        priceMinor: Math.round(Number(tierForm.price) * 100),
        minQuantity: Number(tierForm.minQty || 1),
      },
    });
    setInfo("Wholesale tier saved — applied on sales when customer has this price list");
    await load();
  }

  async function createJob(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/services/jobs", {
      method: "POST",
      token,
      body: {
        branchId: jobForm.branchId,
        title: jobForm.title,
        description: jobForm.description || undefined,
      },
    });
    setJobForm((f) => ({ ...f, title: "", description: "" }));
    await load();
  }

  async function setJobStatus(id: string, status: string) {
    await apiRequest(`/services/jobs/${id}`, { method: "PATCH", token, body: { status } });
    await load();
  }

  return (
    <AppShell title="Industry packs" description="Pharmacy batches & prescriptions, wholesale price lists, and service jobs — shared commerce foundation.">
      {error ? <p className="mb-2 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {info ? <p className="mb-2 text-sm text-emerald-700">{info}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["pharmacy", "wholesale", "services", "hardware"] as const).map((t) => (
          <Button key={t} type="button" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "pharmacy" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createBatch(e)}>
            <p className="font-semibold">Register batch / lot</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Product</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={batchForm.productId} onChange={(e) => setBatchForm({ ...batchForm, productId: e.target.value })}>
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </label>
            <Input label="Batch number" value={batchForm.batchNumber} onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })} />
            <Input label="Expiry" type="date" value={batchForm.expiryDate} onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })} />
            <Input label="Qty on hand" value={batchForm.qty} onChange={(e) => setBatchForm({ ...batchForm, qty: e.target.value })} />
            <Button type="submit">Save batch</Button>
          </form>
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createRx(e)}>
            <p className="font-semibold">Prescription</p>
            <Input label="Patient" value={rxForm.patientName} onChange={(e) => setRxForm({ ...rxForm, patientName: e.target.value })} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Medicine</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={rxForm.productId} onChange={(e) => setRxForm({ ...rxForm, productId: e.target.value })}>
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <Input label="Qty" value={rxForm.quantity} onChange={(e) => setRxForm({ ...rxForm, quantity: e.target.value })} />
            <Input label="Dosage" value={rxForm.dosage} onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })} />
            <Button type="submit">Create Rx</Button>
          </form>
          <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold">Batches</p>
              <ul className="space-y-1 text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="border-t border-[var(--soko-color-border)] py-1">
                    {b.product?.sku} · {b.batchNumber} · qty {b.quantityOnHand} · exp {b.expiryDate ? String(b.expiryDate).slice(0, 10) : "—"} · {b.status}
                  </li>
                ))}
                {!batches.length ? <li className="text-[var(--soko-color-text-muted)]">No batches</li> : null}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-semibold">Prescriptions</p>
              <ul className="space-y-2 text-sm">
                {rxs.map((r) => (
                  <li key={r.id} className="border-t border-[var(--soko-color-border)] pt-2">
                    {r.patientName} · {r.status}
                    <ul className="text-xs text-[var(--soko-color-text-muted)]">
                      {(r.items ?? []).map((i, idx) => (
                        <li key={idx}>{i.quantity}× {i.product?.name ?? "item"}</li>
                      ))}
                    </ul>
                    {r.status === "open" ? (
                      <button type="button" className="mt-1 text-[var(--soko-color-primary)]" onClick={() => void dispense(r.id)}>Dispense</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "wholesale" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createList(e)}>
            <p className="font-semibold">Price list</p>
            <Input label="Code" value={listForm.code} onChange={(e) => setListForm({ ...listForm, code: e.target.value })} />
            <Input label="Name" value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} />
            <Button type="submit">Create</Button>
            <ul className="mt-3 text-sm">
              {lists.map((l) => (
                <li key={l.id}>{l.code} — {l.name} · {l._count?.items ?? 0} items · {l._count?.customers ?? 0} customers</li>
              ))}
            </ul>
          </form>
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void addTier(e)}>
            <p className="font-semibold">Tier price</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">List</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={tierForm.priceListId} onChange={(e) => setTierForm({ ...tierForm, priceListId: e.target.value })}>
                <option value="">Select…</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Product</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={tierForm.productId} onChange={(e) => setTierForm({ ...tierForm, productId: e.target.value })}>
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <Input label="Price" value={tierForm.price} onChange={(e) => setTierForm({ ...tierForm, price: e.target.value })} />
            <Input label="Min qty" value={tierForm.minQty} onChange={(e) => setTierForm({ ...tierForm, minQty: e.target.value })} />
            <Button type="submit">Add tier</Button>
          </form>
        </div>
      ) : null}

      {tab === "hardware" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                await apiRequest("/hardware/serials/receive", {
                  method: "POST",
                  token,
                  body: {
                    productId: serialForm.productId,
                    serialNumber: serialForm.serialNumber,
                    warrantyMonths: Number(serialForm.warrantyMonths) || 12,
                  },
                });
                setSerialForm({ productId: "", serialNumber: "", warrantyMonths: "12" });
                setInfo("Serial received — traceable from stock through sale/return/warranty");
                await load();
              })().catch((err: Error) => setError(err.message));
            }}
          >
            <p className="font-semibold">Receive serialised unit</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Product</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={serialForm.productId} onChange={(e) => setSerialForm({ ...serialForm, productId: e.target.value })}>
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </label>
            <Input label="Serial number" value={serialForm.serialNumber} onChange={(e) => setSerialForm({ ...serialForm, serialNumber: e.target.value })} />
            <Input label="Warranty months" value={serialForm.warrantyMonths} onChange={(e) => setSerialForm({ ...serialForm, warrantyMonths: e.target.value })} />
            <Button type="submit">Receive</Button>
          </form>
          <ul className="space-y-2 text-sm">
            {serials.map((s) => (
              <li key={s.id} className="border-t border-[var(--soko-color-border)] pt-2">
                <span className="font-mono">{s.serialNumber}</span> · {s.product?.sku} · {s.status}
                {s.warrantyEndsAt ? ` · warranty→ ${String(s.warrantyEndsAt).slice(0, 10)}` : ""}
              </li>
            ))}
            {!serials.length ? <li className="text-[var(--soko-color-text-muted)]">No serials yet</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === "services" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-[var(--soko-color-border)] p-4" onSubmit={(e) => void createJob(e)}>
            <p className="font-semibold">Service / repair job</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Branch</span>
              <select className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent px-3 py-2" value={jobForm.branchId} onChange={(e) => setJobForm({ ...jobForm, branchId: e.target.value })}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <Input label="Title" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
            <Input label="Description" value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} />
            <Button type="submit">Open job</Button>
          </form>
          <ul className="space-y-2 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--soko-color-border)] pt-2">
                <span>{j.title} · {j.status}</span>
                <span className="flex gap-1">
                  {["in_progress", "waiting_parts", "done", "cancelled"].map((s) => (
                    <button key={s} type="button" className="text-xs text-[var(--soko-color-primary)]" onClick={() => void setJobStatus(j.id, s)}>{s}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
