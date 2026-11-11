import { useEffect, useState } from "react";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney } from "../lib/money";

type Dash = {
  today: { salesTotalMinor: number; salesCount: number; averageMinor: number };
  week: { salesTotalMinor: number; salesCount: number };
  month: { salesTotalMinor: number; salesCount: number };
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  expensesTodayMinor: number;
  grossProfitTodayMinor: number;
  recentSales: Array<{
    id: string;
    receiptNumber: string;
    totalMinor: number;
    occurredAt: string;
    branchNameSnapshot?: string;
    cashierNameSnapshot?: string;
    payments: Array<{ method: string }>;
  }>;
  topProducts: Array<{ nameSnapshot: string; _sum: { quantity: number | null; lineTotalMinor: number | null } }>;
  paymentBreakdown: Array<{ method: string; _sum: { amountMinor: number | null } }>;
};

export function DashboardPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const dash = await apiRequest<Dash>("/reports/dashboard", { token });
        setData(dash);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    })();
  }, [token]);

  const cards = data
    ? [
        { label: "Today's sales", value: formatMoney(data.today.salesTotalMinor, currency), hint: `${data.today.salesCount} transactions` },
        { label: "This week", value: formatMoney(data.week.salesTotalMinor, currency), hint: `${data.week.salesCount} transactions` },
        { label: "This month", value: formatMoney(data.month.salesTotalMinor, currency), hint: `${data.month.salesCount} transactions` },
        { label: "Avg transaction", value: formatMoney(data.today.averageMinor, currency), hint: "Today" },
        { label: "Gross profit today", value: formatMoney(data.grossProfitTodayMinor, currency), hint: "Revenue − cost" },
        { label: "Active products", value: String(data.activeProducts), hint: `${data.lowStock} low · ${data.outOfStock} out` },
        { label: "Low stock", value: String(data.lowStock), hint: "Needs reorder" },
        { label: "Expenses today", value: formatMoney(data.expensesTodayMinor, currency), hint: "Operating expenses" },
      ]
    : [];

  return (
    <AppShell title="Dashboard" description="Live trading snapshot. Revenue is completed sales, not cash in till.">
      {error ? <p className="mb-4 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4"
          >
            <p className="text-sm text-[var(--soko-color-text-muted)]">{card.label}</p>
            <p className="mt-2 font-display text-2xl">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--soko-color-text-muted)]">{card.hint}</p>
          </div>
        ))}
      </div>

      {data?.paymentBreakdown?.length ? (
        <section className="mt-8">
          <h2 className="font-display text-xl">Payment mix</h2>
          <p className="text-sm text-[var(--soko-color-text-muted)]">Completed allocations only — pending M-Pesa is excluded.</p>
          <ul className="mt-3 space-y-2">
            {data.paymentBreakdown.map((row) => {
              const amount = row._sum.amountMinor ?? 0;
              const max = Math.max(...data.paymentBreakdown.map((r) => r._sum.amountMinor ?? 0), 1);
              const pct = Math.round((amount / max) * 100);
              return (
                <li key={row.method}>
                  <div className="flex justify-between text-sm">
                    <span className="uppercase">{row.method}</span>
                    <span>{formatMoney(amount, currency)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--soko-color-surface-muted)]">
                    <div className="h-full rounded-full bg-[var(--soko-color-primary)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-xl">Recent sales</h2>
          {!data?.recentSales.length ? (
            <EmptyState title="No sales yet" body="Completed receipts will appear here after POS checkout." />
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--soko-color-text-muted)]">
                  <th className="py-2">Receipt</th>
                  <th>Cashier</th>
                  <th>Tender</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-t border-[var(--soko-color-border)]">
                    <td className="py-2">{sale.receiptNumber}</td>
                    <td>{sale.cashierNameSnapshot ?? "—"}</td>
                    <td>{sale.payments.map((p) => p.method).join(", ")}</td>
                    <td className="text-right">{formatMoney(sale.totalMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section>
          <h2 className="font-display text-xl">Best sellers</h2>
          {!data?.topProducts.length ? (
            <EmptyState title="No product mix yet" body="Sales lines feed this ranking." />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.topProducts.map((p) => (
                <li key={p.nameSnapshot} className="flex justify-between text-sm">
                  <span>{p.nameSnapshot}</span>
                  <span className="text-[var(--soko-color-text-muted)]">
                    {p._sum.quantity ?? 0} sold · {formatMoney(p._sum.lineTotalMinor ?? 0, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
