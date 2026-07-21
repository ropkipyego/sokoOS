import { AppShell } from "../components/AppShell";
import { useDemoDataStore } from "../stores/demoData";

export function InventoryPage() {
  const products = useDemoDataStore((s) => s.products);
  const low = products.filter((p) => p.stock <= 5);
  const ok = products.filter((p) => p.stock > 5);

  return (
    <AppShell title="Inventory" description="Stock balances with low-stock items surfaced first.">
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--soko-color-warning)]">Low stock</h2>
        <p className="mb-3 text-sm text-[var(--soko-color-text-muted)]">At or below 5 units.</p>
        <BalanceTable rows={low} empty="No low-stock items right now." />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Healthy balances</h2>
        <p className="mb-3 text-sm text-[var(--soko-color-text-muted)]">Items above the low-stock threshold.</p>
        <BalanceTable rows={ok} empty="No products on hand." />
      </section>
    </AppShell>
  );
}

function BalanceTable({
  rows,
  empty,
}: {
  rows: { id: string; sku: string; name: string; stock: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--soko-radius-lg)] border border-dashed border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-4 py-6 text-sm text-[var(--soko-color-text-muted)]">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
          <tr>
            <th className="px-4 py-3 font-semibold">SKU</th>
            <th className="px-4 py-3 font-semibold">Product</th>
            <th className="px-4 py-3 text-right font-semibold">On hand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
              <td className="px-4 py-3 font-medium">{row.sku}</td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
