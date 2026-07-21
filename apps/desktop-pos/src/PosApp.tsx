import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@sokoos/ui";
import { getLocalDb, SEED_CATEGORIES, type LocalDb, type ProductRecord } from "./db";
import { SyncWorker, type SyncStatus } from "./sync";
import { completeSaleOffline } from "./lib/completeSale";
import { cartTotals, formatMoney, useCartStore } from "./stores/cart";
import { useThemeStore } from "./stores/theme";

export function PosApp() {
  const [db, setDb] = useState<LocalDb | null>(null);
  const [sync, setSync] = useState<SyncWorker | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const payRef = useRef<() => Promise<void>>(async () => undefined);

  const lines = useCartStore((s) => s.lines);
  const tender = useCartStore((s) => s.tender);
  const lastSale = useCartStore((s) => s.lastSale);
  const paySuccessPulse = useCartStore((s) => s.paySuccessPulse);
  const addProduct = useCartStore((s) => s.addProduct);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const setTender = useCartStore((s) => s.setTender);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  const totals = cartTotals(lines);

  useEffect(() => {
    hydrateTheme();
    let worker: SyncWorker | null = null;
    void (async () => {
      const localDb = await getLocalDb();
      setDb(localDb);
      setProducts(await localDb.listProducts());
      worker = new SyncWorker(localDb);
      setSync(worker);
      worker.subscribe(setSyncStatus);
      void worker.flush();
    })();
    return () => worker?.dispose();
  }, [hydrateTheme]);

  async function refreshProducts() {
    if (!db) return;
    setProducts(await db.listProducts());
  }

  async function handlePay() {
    if (!db || !sync || lines.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await completeSaleOffline(db, sync);
      await refreshProducts();
      searchRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed");
    } finally {
      setBusy(false);
    }
  }

  payRef.current = handlePay;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (event.key === "F9") {
        event.preventDefault();
        void payRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const catOk = category === "All" || product.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q);
    });
  }, [products, query, category]);

  return (
    <div className="soko-ui flex h-full min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="font-display text-2xl text-[var(--soko-color-primary)]">SokoOS</p>
          <span className="text-sm text-[var(--soko-color-text-muted)]">Nairobi CBD · Cashier</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SyncPill status={syncStatus} />
          <span className="rounded-[var(--soko-radius-md)] bg-[var(--soko-color-surface-muted)] px-2 py-1 text-[var(--soko-color-text-muted)]">
            F2 search · F9 pay
          </span>
          <Button variant="ghost" size="sm" className="touch-btn" onClick={toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1.55fr_1fr]">
        <section className="flex min-h-0 flex-col gap-3 border-b border-[var(--soko-color-border)] p-4 lg:border-r lg:border-b-0">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Search products</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan barcode or search name…"
              className="w-full rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-4 py-3 text-lg outline-none focus:shadow-[var(--soko-shadow-focus)]"
              aria-label="Product search"
              autoFocus
            />
            <span className="mt-1 block text-xs text-[var(--soko-color-text-muted)]">
              Barcode or name — press F2 to focus
            </span>
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {SEED_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`touch-btn rounded-[var(--soko-radius-md)] border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                  category === cat
                    ? "border-[var(--soko-color-primary)] bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                    : "border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] text-[var(--soko-color-text-muted)]"
                }`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="touch-btn flex min-h-[88px] flex-col items-start justify-between rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-3 text-left transition-colors hover:border-[var(--soko-color-primary)]"
                onClick={() => addProduct(product)}
              >
                <span className="text-base font-semibold leading-tight">{product.name}</span>
                <span className="mt-2 flex w-full items-end justify-between gap-2">
                  <span className="text-sm tabular-nums text-[var(--soko-color-primary)]">
                    {formatMoney(product.priceCents)}
                  </span>
                  <span className="text-xs text-[var(--soko-color-text-muted)]">{product.stock} left</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col bg-[var(--soko-color-surface-muted)] p-4" aria-label="Cart">
          <h2 className="text-lg font-semibold">Cart</h2>
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="text-sm text-[var(--soko-color-text-muted)]">
                Tap a product to start — SokoOS keeps checkout on one screen.
              </p>
            ) : (
              lines.map((line) => (
                <div
                  key={line.productId}
                  className="cart-line-enter flex items-center justify-between gap-2 rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{line.name}</p>
                    <p className="text-sm tabular-nums text-[var(--soko-color-text-muted)]">
                      {formatMoney(line.unitPriceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="touch-btn rounded-[var(--soko-radius-sm)] border border-[var(--soko-color-border)] px-3 text-lg font-bold"
                      onClick={() => setQty(line.productId, line.qty - 1)}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums">{line.qty}</span>
                    <button
                      type="button"
                      className="touch-btn rounded-[var(--soko-radius-sm)] border border-[var(--soko-color-border)] px-3 text-lg font-bold"
                      onClick={() => setQty(line.productId, line.qty + 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="touch-btn ml-1 text-sm font-semibold text-[var(--soko-color-danger)]"
                      onClick={() => removeLine(line.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            className={`mt-4 space-y-1 border-t border-[var(--soko-color-border)] pt-4 ${
              paySuccessPulse ? "pay-success-pulse" : ""
            }`}
          >
            <div className="flex justify-between text-sm text-[var(--soko-color-text-muted)]">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--soko-color-text-muted)]">
              <span>Tax</span>
              <span className="tabular-nums">{formatMoney(totals.taxCents)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span>
              <span className="tabular-nums text-[var(--soko-color-primary)]">
                {formatMoney(totals.totalCents)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["cash", "mpesa", "card"] as const).map((method) => (
              <button
                key={method}
                type="button"
                className={`touch-btn rounded-[var(--soko-radius-md)] border px-2 text-sm font-semibold uppercase ${
                  tender === method
                    ? "border-[var(--soko-color-accent)] bg-[var(--soko-color-accent-muted)] text-[var(--soko-color-text)]"
                    : "border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]"
                }`}
                onClick={() => setTender(method)}
              >
                {method === "mpesa" ? "M-Pesa" : method}
              </button>
            ))}
          </div>

          {error ? <p className="mt-2 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
          {lastSale ? (
            <p className="mt-2 text-sm text-[var(--soko-color-success)]" aria-live="polite">
              Sale {lastSale.receiptNo} saved locally · {formatMoney(lastSale.totalCents)}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2">
            <Button
              size="lg"
              className="touch-btn w-full text-lg"
              disabled={lines.length === 0 || busy || !db}
              onClick={() => void handlePay()}
            >
              {busy ? "Saving…" : "Complete sale (F9)"}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="touch-btn w-full"
              disabled={!lastSale}
              onClick={() => {
                if (!lastSale) return;
                window.alert(
                  `Receipt ${lastSale.receiptNo}\nTotal ${formatMoney(lastSale.totalCents)}\n(Print stub)`,
                );
              }}
            >
              Receipt / print
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SyncPill({ status }: { status: SyncStatus }) {
  const label =
    status === "synced"
      ? "Synced"
      : status === "syncing"
        ? "Syncing…"
        : status === "offline"
          ? "Offline"
          : status === "error"
            ? "Sync pending"
            : "Ready";

  return (
    <span
      className="rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-2 py-1 font-semibold text-[var(--soko-color-text-muted)]"
      title="Background sync status"
    >
      {label}
    </span>
  );
}
