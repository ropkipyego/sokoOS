import { AppShell } from "../components/AppShell";
import { formatMoney, useDemoDataStore } from "../stores/demoData";

export function SalesPage() {
  const sales = useDemoDataStore((s) => s.sales);

  return (
    <AppShell title="Sales" description="Completed receipts — local demo data until the API is wired.">
      <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Receipt</th>
              <th className="px-4 py-3 font-semibold">Branch</th>
              <th className="px-4 py-3 font-semibold">Tender</th>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
                <td className="px-4 py-3 font-medium">{sale.receiptNo}</td>
                <td className="px-4 py-3">{sale.branch}</td>
                <td className="px-4 py-3">{sale.tender}</td>
                <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(sale.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
