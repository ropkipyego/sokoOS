import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState, ProductImage } from "../components/AppShell";
import { apiRequest, mediaUrl } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney, parseMoneyToMinor } from "../lib/money";

type Product = {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  priceMinor: number;
  costMinor?: number | null;
  status: string;
  featured: boolean;
  itemType?: string;
  minStockQty: number;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
};

const ITEM_TYPES = ["stock", "prepared", "service", "accommodation", "composite", "non_stock"] as const;

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      rec[h] = (cols[i] ?? "").trim();
    });
    return rec;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function ProductsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [barcode, setBarcode] = useState("");
  const [featured, setFeatured] = useState(false);
  const [itemType, setItemType] = useState<string>("stock");
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiRequest<{ data?: Product[] } | Product[]>("/products?limit=200", { token });
    const rows = Array.isArray(res) ? res : ((res as { data?: Product[] }).data ?? []);
    setProducts(rows);
  }

  useEffect(() => {
    void load().catch((err: { message?: string }) => setError(err.message ?? "Failed to load"));
  }, [token]);

  useEffect(() => {
    if (!createImage) {
      setCreatePreview(null);
      return;
    }
    const url = URL.createObjectURL(createImage);
    setCreatePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [createImage]);

  async function uploadImage(productId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    await apiRequest(`/products/${productId}/image`, { method: "POST", token, body });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const created = await apiRequest<Product>("/products", {
        method: "POST",
        token,
        body: {
          sku,
          name,
          barcode: barcode || undefined,
          priceMinor: parseMoneyToMinor(price),
          costMinor: cost ? parseMoneyToMinor(cost) : undefined,
          featured,
          itemType,
        },
      });
      if (createImage) {
        await uploadImage(created.id, createImage);
      }
      setSku("");
      setName("");
      setPrice("");
      setCost("");
      setBarcode("");
      setFeatured(false);
      setItemType("stock");
      setCreateImage(null);
      setInfo(createImage ? "Product created with image." : "Product created. You can still add an image from the list.");
      await load();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImage(product: Product, file: File) {
    setError(null);
    try {
      await uploadImage(product.id, file);
      await load();
    } catch (err) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Image upload failed");
    }
  }

  async function clearImage(product: Product) {
    await apiRequest(`/products/${product.id}/image`, { method: "DELETE", token });
    await load();
  }

  async function toggleFeatured(product: Product) {
    await apiRequest(`/products/${product.id}`, {
      method: "PATCH",
      token,
      body: { featured: !product.featured },
    });
    await load();
  }

  async function importCsv(text = csvText) {
    setError(null);
    setInfo(null);
    const rows = parseCsv(text);
    if (!rows.length) {
      setError("CSV is empty — download the template first");
      return;
    }
    const result = await apiRequest<{
      accepted: number;
      rejected: number;
      errors: Array<{ row: number; sku?: string; error: string }>;
    }>("/products/import", { method: "POST", token, body: { rows } });
    const sample = result.errors[0]
      ? ` First error row ${result.errors[0].row}: ${result.errors[0].error}`
      : "";
    setInfo(`Imported ${result.accepted}, rejected ${result.rejected}.${sample}`);
    await load();
  }

  function downloadTemplate() {
    void apiRequest<string>("/products/import-template.csv", { token, raw: true }).then((csv) => {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sokoos-product-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const filtered = products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.sku.toLowerCase().includes(q.toLowerCase()) ||
      (p.barcode ?? "").includes(q),
  );

  return (
    <AppShell title="Products" description="Catalogue with images, featured POS items, barcodes, and CSV bulk import.">
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {info ? <p className="mb-3 text-sm text-[var(--soko-color-success)]">{info}</p> : null}

      <form
        onSubmit={onCreate}
        className="mb-6 grid gap-3 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4 md:grid-cols-6"
      >
        <div className="md:col-span-6">
          <p className="mb-2 text-sm font-semibold">Create product</p>
        </div>
        <label className="md:row-span-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] p-3 text-center text-xs">
          {createPreview ? (
            <img src={createPreview} alt="" className="h-24 w-24 rounded object-cover" />
          ) : (
            <span className="text-[var(--soko-color-text-muted)]">Product image<br />JPEG / PNG / WebP · max 2MB</span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
          />
          <span className="font-semibold text-[var(--soko-color-primary)]">{createImage ? "Change image" : "Upload image"}</span>
          {createImage ? (
            <button type="button" className="text-[var(--soko-color-danger)]" onClick={() => setCreateImage(null)}>
              Remove
            </button>
          ) : null}
        </label>
        <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <Input label={`Selling price (${currency})`} value={price} onChange={(e) => setPrice(e.target.value)} required />
        <Input label={`Buying price (${currency})`} value={cost} onChange={(e) => setCost(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          Item type
          <select
            className="rounded border border-[var(--soko-color-border)] bg-transparent px-2 py-1.5"
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured in POS
        </label>
        <div className="md:col-span-6">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create product"}</Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            void apiRequest<string>("/products/export.csv", { token, raw: true }).then((csv) => {
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "sokoos-products.csv";
              a.click();
              URL.revokeObjectURL(url);
            });
          }}
        >
          Export CSV
        </Button>
      </div>

      <details className="mb-6 rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] p-4" open>
        <summary className="cursor-pointer font-semibold">Bulk import (CSV)</summary>
        <div className="mt-3 space-y-3 text-sm text-[var(--soko-color-text-muted)]">
          <p>
            <strong className="text-[var(--soko-color-text)]">Required columns:</strong>{" "}
            <code>sku</code>, <code>name</code>, <code>price</code> (e.g. <code>1250.00</code> in {currency}).
          </p>
          <p>
            <strong className="text-[var(--soko-color-text)]">Optional:</strong>{" "}
            <code>barcode</code>, <code>cost</code>, <code>minStockQty</code>, <code>featured</code> (true/false),{" "}
            <code>imageUrl</code> (public https link only).
          </p>
          <p>
            CSV cannot carry image files. For local photos: create/import products first, then click each product image in the table to upload,
            or put a public <code>imageUrl</code> in the sheet.
          </p>
          <pre className="overflow-x-auto rounded-md bg-[var(--soko-color-surface-muted)] p-3 font-mono text-xs text-[var(--soko-color-text)]">
{`sku,name,barcode,price,cost,minStockQty,featured,imageUrl
RICE-5KG,Premium Rice 5kg,6001234567890,1250.00,980.00,5,true,
OIL-2L,Cooking Oil 2L,6001234567891,890.00,720.00,8,false,https://cdn.example.com/oil.jpg`}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              Download template
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border border-[var(--soko-color-border)] px-3 py-2 text-sm font-semibold">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => {
                    setCsvText(text);
                    setInfo(`Loaded ${file.name}. Review then click Import.`);
                  });
                }}
              />
            </label>
          </div>
        </div>
        <textarea
          className="mt-3 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2 font-mono text-sm"
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste CSV here or choose a file…"
        />
        <Button className="mt-2" type="button" onClick={() => void importCsv()}>
          Import CSV
        </Button>
      </details>

      {!filtered.length ? (
        <EmptyState title="No products" body="Create a SKU with an image, or import the CSV template." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--soko-color-text-muted)]">
                <th className="py-2">Image</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Type</th>
                <th>Barcode</th>
                <th>Price</th>
                <th>Featured</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-[var(--soko-color-border)]">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <label className="block cursor-pointer" title="Click to upload / replace image">
                        <ProductImage src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt={p.name} className="h-14 w-14" />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void onImage(p, file);
                          }}
                        />
                      </label>
                      {p.imageUrl ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--soko-color-danger)]"
                          onClick={() => void clearImage(p)}
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--soko-color-text-muted)]">Click img</span>
                      )}
                    </div>
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td className="capitalize text-xs">{p.itemType ?? "stock"}</td>
                  <td>{p.barcode ?? "—"}</td>
                  <td>{formatMoney(p.priceMinor, currency)}</td>
                  <td>
                    <button type="button" className="text-[var(--soko-color-primary)]" onClick={() => void toggleFeatured(p)}>
                      {p.featured ? "Yes" : "No"}
                    </button>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void apiRequest(`/products/${p.id}/archive`, { method: "POST", token }).then(load)}
                    >
                      Archive
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
