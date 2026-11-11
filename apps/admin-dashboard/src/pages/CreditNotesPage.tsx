import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney } from "../lib/money";

type Sale = {
  id: string;
  receiptNumber: string;
  totalMinor: number;
  cashierNameSnapshot?: string | null;
  items: Array<{ productId: string; nameSnapshot: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }>;
};

type CreditNote = {
  id: string;
  status: string;
  totalMinor: number;
  reason?: string | null;
  occurredAt: string;
  sale?: { receiptNumber: string; cashierNameSnapshot?: string | null } | null;
  branch?: { name: string } | null;
  items: Array<{ productId: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; product?: { name: string } }>;
};

function cnNumber(id: string) {
  return `CN-${id.slice(0, 8).toUpperCase()}`;
}

export function CreditNotesPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleId, setSaleId] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("Customer return");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CreditNote | null>(null);

  async function load() {
    const [r, s] = await Promise.all([
      apiRequest<CreditNote[] | { data: CreditNote[] }>("/returns?limit=100", { token }),
      apiRequest<Sale[] | { data: Sale[] }>("/sales?limit=50", { token }),
    ]);
    const arr = <T,>(x: T[] | { data: T[] }) => (Array.isArray(x) ? x : x.data);
    setNotes(arr(r));
    setSales(arr(s));
  }

  useEffect(() => {
    void load().catch((err: { message?: string }) => setError(err.message ?? "Load failed"));
  }, [token]);

  async function pickSale(id: string) {
    setSaleId(id);
    setError(null);
    if (!id) {
      setSelected(null);
      return;
    }
    try {
      const sale = await apiRequest<Sale>(`/sales/${id}`, { token });
      setSelected(sale);
      const initial: Record<string, string> = {};
      for (const item of sale.items) initial[item.productId] = String(item.quantity);
      setQty(initial);
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Sale load failed");
    }
  }

  async function createNote(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const items = selected.items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(qty[item.productId] || 0),
        unitPriceMinor: item.unitPriceMinor,
      }))
      .filter((i) => i.quantity > 0);
    if (!items.length) {
      setError("Select at least one line quantity to credit");
      return;
    }
    try {
      const created = await apiRequest<CreditNote>("/returns", {
        method: "POST",
        token,
        body: { saleId: selected.id, reason, items },
      });
      setOpen(created);
      setSelected(null);
      setSaleId("");
      await load();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Credit note failed");
    }
  }

  return (
    <AppShell
      title="Credit notes"
      description="Issue a credit note against an original sale. Stock is restored; the original cashier attribution stays on the sale."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <h2 className="font-display text-xl">Issue credit note</h2>
          <form onSubmit={createNote} className="mt-3 space-y-3">
            <label className="block text-sm">
              Original sale / receipt
              <select
                className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2"
                value={saleId}
                onChange={(e) => void pickSale(e.target.value)}
              >
                <option value="">Select receipt</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.receiptNumber} · {formatMoney(s.totalMinor, currency)}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            {selected ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--soko-color-text-muted)]">
                    <th className="py-2">Item</th>
                    <th>Sold</th>
                    <th>Credit qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.productId} className="border-t border-[var(--soko-color-border)]">
                      <td className="py-2">{item.nameSnapshot}</td>
                      <td>{item.quantity}</td>
                      <td>
                        <input
                          className="w-20 rounded border border-[var(--soko-color-border)] bg-transparent px-2 py-1"
                          value={qty[item.productId] ?? "0"}
                          onChange={(e) => setQty((m) => ({ ...m, [item.productId]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <Button type="submit" disabled={!selected}>Create credit note</Button>
          </form>
        </section>

        <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <h2 className="font-display text-xl">Credit note register</h2>
          {!notes.length ? (
            <EmptyState title="No credit notes" body="Select a completed sale and credit one or more lines." />
          ) : (
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-[var(--soko-color-border)] px-3 py-2 text-left"
                    onClick={() => setOpen(n)}
                  >
                    <span className="font-semibold">{cnNumber(n.id)}</span>
                    <span className="ml-2 text-xs">vs {n.sale?.receiptNumber ?? "sale"}</span>
                    <span className="float-right">{formatMoney(n.totalMinor, currency)}</span>
                    <div className="text-xs text-[var(--soko-color-text-muted)]">
                      {new Date(n.occurredAt).toLocaleString()} · served by {n.sale?.cashierNameSnapshot ?? "original cashier"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {open ? (
        <section className="mt-8 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-white p-6 text-black">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-neutral-500">Credit note</p>
              <h2 className="font-display text-2xl font-bold">{cnNumber(open.id)}</h2>
              <p className="text-sm text-neutral-600">Against receipt {open.sale?.receiptNumber ?? "—"}</p>
              <p className="text-xs text-neutral-500">Original cashier: {open.sale?.cashierNameSnapshot ?? "preserved on sale"}</p>
            </div>
            <div className="text-right text-sm">
              <p>{new Date(open.occurredAt).toLocaleString()}</p>
              <p className="uppercase">{open.status}</p>
              <Button variant="secondary" className="mt-2 print:hidden" onClick={() => window.print()}>Print</Button>
            </div>
          </div>
          <p className="mt-3 text-sm">Reason: {open.reason ?? "—"}</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500">
                <th className="py-2">Item</th>
                <th>Qty</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {open.items.map((item, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2">{item.product?.name ?? item.productId}</td>
                  <td>{item.quantity}</td>
                  <td className="text-right">{formatMoney(item.lineTotalMinor, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end font-bold">
            <span>Credit total {formatMoney(open.totalMinor, currency)}</span>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
