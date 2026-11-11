import { useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney, parseMoneyToMinor } from "../lib/money";

type Sale = {
  id: string;
  receiptNumber: string;
  totalMinor: number;
  status: string;
  occurredAt: string;
  cashierNameSnapshot?: string | null;
  branchNameSnapshot?: string | null;
  fiscalStatus?: string;
  payments: Array<{ method: string; amountMinor: number; tenderedMinor?: number | null; changeMinor?: number | null; status: string }>;
  items: Array<{ nameSnapshot: string; quantity: number; lineTotalMinor: number }>;
  customer?: { name: string } | null;
};

export function SalesPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [sales, setSales] = useState<Sale[]>([]);
  const [open, setOpen] = useState<Sale | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<Sale[] | { data: Sale[] }>("/sales?limit=100", { token }).then((r) => {
      setSales(Array.isArray(r) ? r : r.data);
    });
  }, [token]);

  return (
    <AppShell title="Sales history" description="Cashier identity is taken from the signed-in user, not typed names.">
      {!sales.length ? (
        <EmptyState title="No receipts" body="Complete a sale on POS to populate this list." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--soko-color-text-muted)]">
              <th className="py-2">Receipt</th>
              <th>When</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="cursor-pointer border-t border-[var(--soko-color-border)]" onClick={() => setOpen(s)}>
                <td className="py-2">{s.receiptNumber}</td>
                <td>{new Date(s.occurredAt).toLocaleString()}</td>
                <td>{s.cashierNameSnapshot ?? "—"}</td>
                <td>{s.customer?.name ?? "Walk-in"}</td>
                <td>{s.status}</td>
                <td className="text-right">{formatMoney(s.totalMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open ? (
        <div className="mt-6 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <h2 className="font-display text-xl">{open.receiptNumber}</h2>
          <p className="text-sm text-[var(--soko-color-text-muted)]">
            {open.branchNameSnapshot} · served by {open.cashierNameSnapshot} · fiscal {open.fiscalStatus ?? "not_configured"}
          </p>
          <ul className="mt-3 text-sm">
            {open.items.map((i) => (
              <li key={i.nameSnapshot} className="flex justify-between py-1">
                <span>{i.nameSnapshot} × {i.quantity}</span>
                <span>{formatMoney(i.lineTotalMinor, currency)}</span>
              </li>
            ))}
          </ul>
          {open.payments.map((p, idx) => (
            <p key={idx} className="mt-2 text-sm">
              {p.method} {formatMoney(p.amountMinor, currency)}
              {p.tenderedMinor ? ` · tendered ${formatMoney(p.tenderedMinor, currency)}` : ""}
              {p.changeMinor ? ` · change ${formatMoney(p.changeMinor, currency)}` : ""}
              {p.status !== "completed" ? ` · ${p.status}` : ""}
            </p>
          ))}
          <button type="button" className="mt-3 text-sm text-[var(--soko-color-primary)]" onClick={() => window.print()}>
            Reprint / print preview
          </button>
          <form
            className="mt-4 grid gap-2 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              void apiRequest("/deliveries", {
                method: "POST",
                token,
                body: {
                  saleId: open.id,
                  phone: deliveryPhone || undefined,
                  address: deliveryAddress || undefined,
                  feeMinor: parseMoneyToMinor(deliveryFee || "0"),
                },
              }).then(() => setDeliveryMsg("Delivery created against this sale"));
            }}
          >
            <Input label="Delivery phone" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} />
            <Input label="Address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            <Input label="Fee" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
            <Button type="submit">Create delivery</Button>
          </form>
          {deliveryMsg ? <p className="mt-2 text-sm text-[var(--soko-color-primary)]">{deliveryMsg}</p> : null}
        </div>
      ) : null}
    </AppShell>
  );
}
