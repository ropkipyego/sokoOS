import { AppShell } from "../components/AppShell";
import { formatMoney, useDemoDataStore } from "../stores/demoData";

export function DashboardPage() {
  const products = useDemoDataStore((s) => s.products);
  const sales = useDemoDataStore((s) => s.sales);
  const lowStock = products.filter((p) => p.stock <= 5).length;
  const todayTotal = sales.reduce((sum, sale) => sum + sale.totalCents, 0);

  const cards = [
    { label: "Sales today", value: formatMoney(todayTotal), hint: `${sales.length} receipts` },
    { label: "Products", value: String(products.length), hint: "Active catalog" },
    { label: "Low stock", value: String(lowStock), hint: "Needs reorder" },
  ];

  return (
    <AppShell title="Dashboard" description="A calm snapshot of today’s trading — nothing more.">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-5"
          >
            <p className="text-sm font-semibold text-[var(--soko-color-text-muted)]">{card.label}</p>
            <p className="mt-2 font-display text-3xl tabular-nums text-[var(--soko-color-text)]">{card.value}</p>
            <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent sales</h2>
        <p className="mb-3 text-sm text-[var(--soko-color-text-muted)]">Latest receipts across branches.</p>
        <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Receipt</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Tender</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium">{sale.receiptNo}</td>
                  <td className="px-4 py-3">{sale.branch}</td>
                  <td className="px-4 py-3">{sale.tender}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(sale.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
