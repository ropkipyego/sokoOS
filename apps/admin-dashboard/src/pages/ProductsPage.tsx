import { useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { formatMoney, useDemoDataStore } from "../stores/demoData";

export function ProductsPage() {
  const products = useDemoDataStore((s) => s.products);
  const addProduct = useDemoDataStore((s) => s.addProduct);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Staples");
  const [price, setPrice] = useState("10.00");
  const [stock, setStock] = useState("10");

  function onCreate(event: FormEvent) {
    event.preventDefault();
    const priceCents = Math.round(Number.parseFloat(price || "0") * 100);
    const stockQty = Number.parseInt(stock || "0", 10);
    if (!name.trim() || !sku.trim() || Number.isNaN(priceCents)) return;
    addProduct({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category: category.trim() || "General",
      priceCents,
      stock: Number.isNaN(stockQty) ? 0 : stockQty,
    });
    setName("");
    setSku("");
    setPrice("10.00");
    setStock("10");
  }

  return (
    <AppShell title="Products" description="Catalog items available for sale across branches.">
      <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
        <form
          onSubmit={onCreate}
          className="h-fit space-y-3 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4"
        >
          <h2 className="text-lg font-semibold">Create product</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
          <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Price (KES)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input label="Opening stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          <Button type="submit" className="btn-press w-full">
            Add product
          </Button>
        </form>

        <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium">{product.sku}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(product.priceCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{product.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
