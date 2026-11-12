import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { getLocalDb, type LocalDb, type ProductRecord } from "./db";
import { SyncWorker, type SyncStatus } from "./sync";
import { completeSaleOffline } from "./lib/completeSale";
import { cartTotals, formatMoney, useCartStore } from "./stores/cart";
import { useThemeStore } from "./stores/theme";
import { useSession } from "./stores/session";
import { apiRequest, mediaUrl } from "./api/client";

type Customer = { id: string; name: string; phone?: string | null };
type DiningTable = { id: string; code: string; label?: string | null; seats: number; status: string };
type OrderType = "retail" | "dine_in" | "takeaway" | "delivery";

export function PosApp() {
  const accessToken = useSession((s) => s.accessToken);
  const login = useSession((s) => s.login);
  const [email, setEmail] = useState("owner@honeywell.demo");
  const [password, setPassword] = useState("Honeywell123!");
  const [tenantSlug, setTenantSlug] = useState("honeywell");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busyLogin, setBusyLogin] = useState(false);

  useEffect(() => {
    useSession.getState().hydrate();
  }, []);

  if (!accessToken) {
    return (
      <div className="soko-ui pos-login flex min-h-screen items-center justify-center p-6">
        <form
          className="pos-login-card w-full max-w-sm space-y-3 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-6 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            setBusyLogin(true);
            setLoginError(null);
            void login(email, password, tenantSlug)
              .catch((err: Error) => setLoginError(err.message))
              .finally(() => setBusyLogin(false));
          }}
        >
          <p className="font-display text-3xl text-[var(--soko-color-primary)]">SokoOS POS</p>
          <p className="text-sm text-[var(--soko-color-text-muted)]">Retail · Restaurant · Hybrid tenants</p>
          <Input label="Tenant" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} />
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError ? <p className="text-sm text-[var(--soko-color-danger)]">{loginError}</p> : null}
          <Button type="submit" className="w-full" disabled={busyLogin}>{busyLogin ? "Signing in…" : "Sign in"}</Button>
          <p className="text-xs text-[var(--soko-color-text-muted)]">
            Try tenant <code>honeywell</code> or <code>demo</code> / demo@sokoos.local / Demo123!
          </p>
        </form>
      </div>
    );
  }

  return <PosTerminal />;
}

function PosTerminal() {
  const [db, setDb] = useState<LocalDb | null>(null);
  const [sync, setSync] = useState<SyncWorker | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingSync, setPendingSync] = useState(0);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanFlash, setScanFlash] = useState<string | null>(null);
  const [scanUnknown, setScanUnknown] = useState<string | null>(null);
  const [customerQ, setCustomerQ] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [printOpen, setPrintOpen] = useState(false);
  const [printProfile, setPrintProfile] = useState<"thermal-80" | "thermal-58" | "a4">("thermal-80");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitSecondMethod, setSplitSecondMethod] = useState<"mpesa" | "card" | "bank">("mpesa");
  const [splitSecondMinor, setSplitSecondMinor] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("retail");
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [tableCode, setTableCode] = useState<string | null>(null);
  const [scannerArmed, setScannerArmed] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const wedgeRef = useRef<HTMLInputElement>(null);
  const payRef = useRef<() => Promise<void>>(async () => undefined);
  const productsRef = useRef<ProductRecord[]>([]);
  const scanBuf = useRef("");
  const scanAt = useRef(0);

  const session = useSession();
  const lines = useCartStore((s) => s.lines);
  const tender = useCartStore((s) => s.tender);
  const cashTenderedCents = useCartStore((s) => s.cashTenderedCents);
  const lastSale = useCartStore((s) => s.lastSale);
  const paySuccessPulse = useCartStore((s) => s.paySuccessPulse);
  const addProduct = useCartStore((s) => s.addProduct);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const setTender = useCartStore((s) => s.setTender);
  const setCashTendered = useCartStore((s) => s.setCashTendered);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const totals = cartTotals(lines);
  const changeDue = Math.max(0, cashTenderedCents - totals.totalCents);
  const remaining = Math.max(0, totals.totalCents - cashTenderedCents);
  const restaurantOn = session.restaurantEnabled;

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    if (restaurantOn && orderType === "retail") setOrderType("dine_in");
    if (!restaurantOn) {
      setOrderType("retail");
      setTableCode(null);
    }
  }, [restaurantOn, orderType]);

  function stockFor(productId: string) {
    return productsRef.current.find((p) => p.id === productId)?.stock;
  }

  function addFromCatalog(product: ProductRecord) {
    // Kitchen/prep items often report 0 stock (trackInventory=false). Cap only when stock > 0.
    if (product.stock > 0) addProduct(product, product.stock);
    else addProduct(product);
    setScanFlash(product.name);
    window.setTimeout(() => setScanFlash(null), 700);
  }

  async function refreshBalances(token: string | null) {
    if (!token) return;
    try {
      const balances = await apiRequest<Array<{ productId: string; quantity: number }> | { data: Array<{ productId: string; quantity: number }> }>(
        "/stock/balances?limit=400",
        { token },
      );
      const bal = Array.isArray(balances) ? balances : balances.data;
      const qty = new Map<string, number>();
      for (const b of bal) qty.set(b.productId, (qty.get(b.productId) ?? 0) + b.quantity);
      setProducts((prev) => prev.map((p) => ({ ...p, stock: qty.has(p.id) ? (qty.get(p.id) as number) : p.stock })));
    } catch {
      /* keep */
    }
  }

  async function loadTables(token: string | null, branchId: string | null) {
    if (!token || !branchId || !restaurantOn) return;
    try {
      const res = await apiRequest<DiningTable[] | { data: DiningTable[] }>(
        `/dining-tables?branchId=${branchId}`,
        { token },
      );
      setTables(Array.isArray(res) ? res : res.data);
    } catch {
      setTables([]);
    }
  }

  useEffect(() => {
    hydrateTheme();
    let worker: SyncWorker | null = null;
    void (async () => {
      const localDb = await getLocalDb();
      setDb(localDb);
      worker = new SyncWorker(localDb, {
        accessToken: session.accessToken,
        deviceId: session.deviceId ?? sessionStorage.getItem("sokoos.pos.deviceId") ?? undefined,
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorUserId: session.cashierId,
      });
      setSync(worker);
      worker.subscribe((status, pending) => {
        setSyncStatus(status);
        setPendingSync(pending);
      });
      void worker.flush();
      try {
        const remote = await apiRequest<Array<{
          id: string; sku: string; name: string; barcode?: string | null; priceMinor: number;
          imageUrl?: string | null; thumbnailUrl?: string | null; featured?: boolean; category?: { name: string } | null;
        }> | { data: Array<{
          id: string; sku: string; name: string; barcode?: string | null; priceMinor: number;
          imageUrl?: string | null; thumbnailUrl?: string | null; featured?: boolean; category?: { name: string } | null;
        }> }>("/products?limit=400", { token: session.accessToken });
        const list = Array.isArray(remote) ? remote : remote.data;
        const balances = await apiRequest<Array<{ productId: string; quantity: number }> | { data: Array<{ productId: string; quantity: number }> }>(
          "/stock/balances?limit=400",
          { token: session.accessToken },
        );
        const bal = Array.isArray(balances) ? balances : balances.data;
        const qty = new Map<string, number>();
        for (const b of bal) qty.set(b.productId, (qty.get(b.productId) ?? 0) + b.quantity);
        const mapped: ProductRecord[] = list.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name ?? "General",
          priceCents: p.priceMinor,
          stock: qty.get(p.id) ?? 0,
          barcode: p.barcode,
          imageUrl: p.thumbnailUrl ?? p.imageUrl,
          featured: p.featured,
        }));
        setProducts(mapped.length ? mapped : await localDb.listProducts());
        await loadTables(session.accessToken, session.branchId);
      } catch {
        setProducts(await localDb.listProducts());
      }
    })();
    return () => worker?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateTheme, session.accessToken, session.branchId, restaurantOn]);

  async function handlePay() {
    if (!db || !sync || lines.length === 0 || busy) return;
    if (orderType === "dine_in" && !tableCode) {
      setError("Pick a table for dine-in");
      return;
    }
    const second = splitEnabled ? Math.max(0, Math.min(splitSecondMinor, totals.totalCents)) : 0;
    const primaryAmount = totals.totalCents - second;
    if (primaryAmount < 0 || (splitEnabled && second <= 0)) {
      setError("Split amounts must reconcile to the sale total");
      return;
    }
    if (tender === "cash" && cashTenderedCents < primaryAmount) {
      setError("Cash tendered is less than the cash portion");
      return;
    }
    if ((tender === "mpesa" || (splitEnabled && splitSecondMethod === "mpesa")) && !navigator.onLine) {
      setError("M-Pesa needs internet. Take cash or wait for a connection.");
      return;
    }
    if (splitEnabled && !navigator.onLine) {
      setError("Split payments require an online API sale.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const online = navigator.onLine && !!session.accessToken && !!session.branchId;
      const snapshotCustomer = customer;
      const snapshotCash = cashTenderedCents;
      const snapshotTender = tender;
      const snapshotOrder = orderType;
      const snapshotTable = tableCode;
      if (online) {
        if (orderType === "dine_in" && tableCode) {
          const table = tables.find((t) => t.code === tableCode);
          if (table) {
            try {
              await apiRequest(`/dining-tables/${table.id}/status`, {
                method: "PATCH",
                token: session.accessToken,
                body: { status: "occupied" },
              });
            } catch {
              /* non-blocking */
            }
          }
        }
        const method = tender === "mpesa" ? "mobile_money" : tender;
        const payments = [
          {
            method,
            amountMinor: primaryAmount,
            tenderedMinor: tender === "cash" ? cashTenderedCents : undefined,
            changeMinor: tender === "cash" ? Math.max(0, cashTenderedCents - primaryAmount) : undefined,
            status: tender === "mpesa" ? "pending" : "completed",
          },
          ...(second > 0
            ? [
                {
                  method: splitSecondMethod === "mpesa" ? "mobile_money" : splitSecondMethod,
                  amountMinor: second,
                  status: splitSecondMethod === "mpesa" ? "pending" : "completed",
                },
              ]
            : []),
        ];
        const sale = await apiRequest<{
          id: string;
          receiptNumber: string;
          totalMinor: number;
          occurredAt: string;
          items: Array<{ productId: string; nameSnapshot: string; quantity: number; lineTotalMinor: number }>;
        }>("/sales", {
          method: "POST",
          token: session.accessToken,
          body: {
            branchId: session.branchId,
            warehouseId: session.warehouseId,
            departmentId: session.departmentId ?? undefined,
            customerId: customer?.id,
            orderType,
            tableCode: orderType === "dine_in" ? tableCode : undefined,
            items: lines.map((l) => ({ productId: l.productId, quantity: l.qty, unitPriceMinor: l.unitPriceCents })),
            payments,
          },
        });
        const cartLines = useCartStore.getState().lines;
        useCartStore.getState().clear();
        useCartStore.getState().setLastSale({
          id: sale.id,
          receiptNo: sale.receiptNumber,
          branchId: session.branchId!,
          tender: snapshotTender,
          subtotalCents: sale.totalMinor,
          taxCents: 0,
          totalCents: sale.totalMinor,
          createdAt: sale.occurredAt,
          synced: true,
          cashTenderedCents: snapshotCash,
          changeCents: snapshotTender === "cash" ? Math.max(0, snapshotCash - sale.totalMinor) : 0,
          customerName: snapshotCustomer?.name ?? null,
          customerPhone: snapshotCustomer?.phone ?? null,
          orderType: snapshotOrder,
          tableCode: snapshotTable,
          lines: (sale.items ?? []).map((i) => {
            const fromCart = cartLines.find((l) => l.productId === i.productId);
            return {
              productId: i.productId,
              sku: fromCart?.sku ?? "",
              name: i.nameSnapshot,
              qty: i.quantity,
              unitPriceCents: fromCart?.unitPriceCents ?? 0,
              lineTotalCents: i.lineTotalMinor,
            };
          }),
        });
        useCartStore.getState().triggerPaySuccess();
        setSplitEnabled(false);
        setSplitSecondMinor(0);
        setTableCode(null);
        setCustomer(null);
        await refreshBalances(session.accessToken);
        await loadTables(session.accessToken, session.branchId);
      } else {
        await completeSaleOffline(db, sync);
        // Optimistic local stock bump for UI
        setProducts((prev) =>
          prev.map((p) => {
            const line = lines.find((l) => l.productId === p.id);
            return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
          }),
        );
      }
      setPrintOpen(true);
      searchRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed");
    } finally {
      setBusy(false);
    }
  }

  payRef.current = handlePay;

  function consumeBarcode(code: string) {
    const trimmed = code.trim();
    if (trimmed.length < 3) return;
    const match = productsRef.current.find((p) => p.barcode === trimmed || p.sku === trimmed);
    if (match) {
      addFromCatalog(match);
      setScanUnknown(null);
    } else {
      setScanUnknown(`Unknown barcode ${trimmed}`);
    }
  }

  // HID keyboard-wedge scanners (Honeywell / Symbol / Zebra): rapid keys + Enter
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === "F9") {
        event.preventDefault();
        void payRef.current();
        return;
      }
      if (!scannerArmed) return;
      const target = event.target as HTMLElement | null;
      const typingInField = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      // Allow wedge even when search focused if keys arrive as a burst
      const now = Date.now();
      const gap = now - scanAt.current;
      if (gap > 120) scanBuf.current = "";
      scanAt.current = now;
      if (event.key === "Enter") {
        if (scanBuf.current.length >= 4) {
          event.preventDefault();
          const code = scanBuf.current;
          scanBuf.current = "";
          consumeBarcode(code);
          if (wedgeRef.current) wedgeRef.current.value = "";
        }
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // If typing slowly in a normal field, don't treat as scan
        if (typingInField && target !== wedgeRef.current && gap > 45 && scanBuf.current.length < 3) {
          scanBuf.current = "";
          return;
        }
        scanBuf.current += event.key;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addProduct, scannerArmed]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (scannerArmed && document.activeElement === document.body) {
        wedgeRef.current?.focus({ preventScroll: true });
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [scannerArmed]);

  async function searchCustomers(q: string) {
    setCustomerQ(q);
    if (q.trim().length < 2 || !session.accessToken) return;
    const res = await apiRequest<Customer[] | { data: Customer[] }>(`/customers?q=${encodeURIComponent(q)}`, {
      token: session.accessToken,
    });
    setCustomers(Array.isArray(res) ? res : res.data);
  }

  async function createCustomer() {
    if (!session.accessToken || !newCustomer.name) return;
    const created = await apiRequest<Customer>("/customers", {
      method: "POST",
      token: session.accessToken,
      body: newCustomer,
    });
    setCustomer(created);
    setNewCustomer({ name: "", phone: "" });
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ["All", "Featured", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category === "Featured" && !product.featured) return false;
      const catOk = category === "All" || category === "Featured" || product.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (product.barcode ?? "").includes(q)
      );
    });
  }, [products, query, category]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const exact = products.find(
        (p) => p.barcode === query.trim() || p.sku.toLowerCase() === query.trim().toLowerCase(),
      );
      if (exact) {
        addFromCatalog(exact);
        setQuery("");
        setScanUnknown(null);
      }
    }
  }

  async function pickTable(t: DiningTable) {
    setTableCode(t.code);
    setOrderType("dine_in");
    if (t.status === "free" && session.accessToken) {
      try {
        await apiRequest(`/dining-tables/${t.id}/status`, {
          method: "PATCH",
          token: session.accessToken,
          body: { status: "occupied" },
        });
        setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "occupied" } : x)));
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="soko-ui pos-shell flex h-full min-h-screen flex-col">
      <input
        ref={wedgeRef}
        aria-label="Barcode scanner capture"
        className="scanner-wedge"
        autoComplete="off"
        tabIndex={-1}
        onChange={(e) => {
          // Some scanners paste full string then Enter handled in keydown
          if (e.target.value.length >= 4 && !e.target.value.includes("\n")) {
            /* wait for Enter via keydown buffer */
          }
        }}
      />
      <header className="pos-header flex flex-wrap items-center justify-between gap-3 border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-2xl text-[var(--soko-color-primary)]">{session.tenantName}</p>
          <span className="text-sm text-[var(--soko-color-text-muted)]">
            {session.branchName}
            {session.departmentName ? ` · ${session.departmentName}` : ""} · {session.cashierName}
          </span>
          <span className="rounded-md bg-[var(--soko-color-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase text-[var(--soko-color-primary)]">
            {session.businessMode}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SyncPill status={syncStatus} pending={pendingSync} />
          <button
            type="button"
            className={`rounded-[var(--soko-radius-md)] border px-2 py-1 text-xs font-semibold ${
              scannerArmed
                ? "border-[var(--soko-color-accent)] bg-[var(--soko-color-accent-muted)]"
                : "border-[var(--soko-color-border)]"
            }`}
            onClick={() => setScannerArmed((v) => !v)}
            title="USB/HID wedge barcode scanner"
          >
            {scannerArmed ? "Scanner ON" : "Scanner OFF"}
          </button>
          <span className="rounded-[var(--soko-radius-md)] bg-[var(--soko-color-surface-muted)] px-2 py-1 text-[var(--soko-color-text-muted)]">
            F2 search · F9 pay
          </span>
          <Button variant="ghost" size="sm" className="touch-btn" onClick={toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </Button>
          <Button variant="secondary" size="sm" onClick={session.logout}>Out</Button>
        </div>
      </header>

      {scanFlash ? <div className="scan-toast" role="status">{scanFlash} added</div> : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <section className="flex min-h-0 flex-col gap-3 border-b border-[var(--soko-color-border)] p-4 lg:border-r lg:border-b-0">
          {restaurantOn ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(["dine_in", "takeaway", "delivery", "retail"] as OrderType[]).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    className={`touch-btn rounded-[var(--soko-radius-md)] border px-3 text-xs font-semibold uppercase ${
                      orderType === ot
                        ? "border-[var(--soko-color-primary)] bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                        : "border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]"
                    }`}
                    onClick={() => {
                      setOrderType(ot);
                      if (ot !== "dine_in") setTableCode(null);
                    }}
                  >
                    {ot.replace("_", " ")}
                  </button>
                ))}
              </div>
              {orderType === "dine_in" ? (
                <div className="floor-grid grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`table-chip touch-btn rounded-lg border px-2 py-3 text-center text-xs font-bold transition ${
                        tableCode === t.code
                          ? "border-[var(--soko-color-accent)] bg-[var(--soko-color-accent-muted)] scale-[1.03]"
                          : t.status === "occupied"
                            ? "border-amber-500/60 bg-amber-500/10"
                            : "border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]"
                      }`}
                      onClick={() => void pickTable(t)}
                    >
                      <div>{t.code}</div>
                      <div className="font-normal opacity-70">{t.seats} seats</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Search / scan</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Scan barcode or search name…"
              className="w-full rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-4 py-3 text-lg outline-none focus:shadow-[var(--soko-shadow-focus)]"
              aria-label="Product search"
              autoFocus
            />
          </label>
          {scanUnknown ? <p className="text-sm text-[var(--soko-color-danger)]">{scanUnknown}</p> : null}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`touch-btn rounded-[var(--soko-radius-md)] border px-4 text-sm font-semibold whitespace-nowrap ${
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

          <div className="product-grid grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="product-card touch-btn flex min-h-[108px] flex-col overflow-hidden rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] text-left"
                onClick={() => addFromCatalog(product)}
              >
                <div className="aspect-[4/3] w-full bg-[var(--soko-color-surface-muted)]">
                  {product.imageUrl ? (
                    <img src={mediaUrl(product.imageUrl) ?? ""} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--soko-color-text-muted)]">No image</div>
                  )}
                </div>
                <span className="px-3 pt-2 text-sm font-semibold leading-tight">{product.name}</span>
                <span className="mt-auto flex w-full items-end justify-between gap-2 px-3 pb-3">
                  <span className="text-sm tabular-nums text-[var(--soko-color-primary)]">
                    {formatMoney(product.priceCents, session.currency)}
                  </span>
                  <span className="text-xs text-[var(--soko-color-text-muted)]">
                    {product.stock > 0 ? `${product.stock} left` : "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col bg-[var(--soko-color-surface-muted)] p-4" aria-label="Cart">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cart</h2>
            {tableCode ? <span className="text-xs font-bold uppercase text-[var(--soko-color-accent)]">Table {tableCode}</span> : null}
          </div>
          <div className="mt-2 rounded-md border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-2">
            <p className="text-xs font-semibold text-[var(--soko-color-text-muted)]">Customer (optional)</p>
            {customer ? (
              <p className="text-sm">
                {customer.name} {customer.phone ? `· ${customer.phone}` : ""}{" "}
                <button type="button" className="text-[var(--soko-color-danger)]" onClick={() => setCustomer(null)}>clear</button>
              </p>
            ) : (
              <>
                <input
                  className="mt-1 w-full rounded border border-[var(--soko-color-border)] bg-transparent px-2 py-1 text-sm"
                  placeholder="Search name or phone"
                  value={customerQ}
                  onChange={(e) => void searchCustomers(e.target.value)}
                />
                {customers.slice(0, 4).map((c) => (
                  <button key={c.id} type="button" className="mt-1 block text-left text-sm" onClick={() => setCustomer(c)}>
                    {c.name}
                  </button>
                ))}
                <div className="mt-2 flex gap-1">
                  <input className="w-1/2 rounded border px-2 py-1 text-sm" placeholder="New name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                  <input className="w-1/2 rounded border px-2 py-1 text-sm" placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                </div>
                <button type="button" className="mt-1 text-xs text-[var(--soko-color-primary)]" onClick={() => void createCustomer()}>
                  Add customer
                </button>
              </>
            )}
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="text-sm text-[var(--soko-color-text-muted)]">Tap, search, or scan. Scanner wedge is armed.</p>
            ) : (
              lines.map((line) => (
                <div key={line.productId} className="cart-line-enter flex items-center justify-between gap-2 rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{line.name}</p>
                    <p className="text-sm tabular-nums text-[var(--soko-color-text-muted)]">{formatMoney(line.unitPriceCents, session.currency)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="touch-btn rounded-[var(--soko-radius-sm)] border px-3 text-lg" onClick={() => setQty(line.productId, line.qty - 1)}>−</button>
                    <span className="w-8 text-center text-lg font-semibold">{line.qty}</span>
                    <button
                      type="button"
                      className="touch-btn rounded-[var(--soko-radius-sm)] border px-3 text-lg"
                      onClick={() => setQty(line.productId, line.qty + 1, stockFor(line.productId))}
                    >
                      +
                    </button>
                    <button type="button" className="touch-btn text-sm text-[var(--soko-color-danger)]" onClick={() => removeLine(line.productId)}>×</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={`mt-4 space-y-1 border-t border-[var(--soko-color-border)] pt-4 ${paySuccessPulse ? "pay-success-pulse" : ""}`}>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span>
              <span className="tabular-nums text-[var(--soko-color-primary)]">{formatMoney(totals.totalCents, session.currency)}</span>
            </div>
            {tender === "cash" ? (
              <>
                <label className="flex items-center justify-between text-sm">
                  Cash tendered
                  <input
                    className="w-28 rounded border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-2 py-1 text-right"
                    value={cashTenderedCents ? (cashTenderedCents / 100).toString() : ""}
                    onChange={(e) => setCashTendered(Math.round(Number(e.target.value || 0) * 100))}
                  />
                </label>
                <div className="flex justify-between text-sm">
                  <span>Change due</span>
                  <span className="font-semibold">{formatMoney(changeDue, session.currency)}</span>
                </div>
                {remaining > 0 ? (
                  <div className="flex justify-between text-sm text-[var(--soko-color-warning)]">
                    <span>Remaining</span>
                    <span>{formatMoney(remaining, session.currency)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(["cash", "mpesa", "card", "bank", "credit"] as const).map((method) => (
              <button
                key={method}
                type="button"
                className={`touch-btn rounded-[var(--soko-radius-md)] border px-2 text-xs font-semibold uppercase ${
                  tender === method
                    ? "border-[var(--soko-color-accent)] bg-[var(--soko-color-accent-muted)]"
                    : "border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]"
                }`}
                onClick={() => setTender(method)}
              >
                {method === "mpesa" ? "M-Pesa" : method}
              </button>
            ))}
          </div>
          {tender === "mpesa" ? (
            <p className="mt-1 text-xs text-[var(--soko-color-warning)]">STK is pending until callback. Cash still works offline.</p>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={splitEnabled} onChange={(e) => setSplitEnabled(e.target.checked)} />
            Split payment
          </label>
          {splitEnabled ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <select
                className="rounded border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-2 py-1"
                value={splitSecondMethod}
                onChange={(e) => setSplitSecondMethod(e.target.value as typeof splitSecondMethod)}
              >
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
              </select>
              <input
                className="rounded border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-2 py-1 text-right"
                placeholder="Second amount"
                value={splitSecondMinor ? (splitSecondMinor / 100).toString() : ""}
                onChange={(e) => setSplitSecondMinor(Math.round(Number(e.target.value || 0) * 100))}
              />
              <p className="col-span-2 text-xs text-[var(--soko-color-text-muted)]">
                Primary ({tender}): {formatMoney(Math.max(0, totals.totalCents - splitSecondMinor), session.currency)}
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}

          <div className="mt-4 grid gap-2">
            <Button size="lg" className="touch-btn w-full text-lg" disabled={lines.length === 0 || busy || !db} onClick={() => void handlePay()}>
              {busy ? "Saving…" : orderType === "dine_in" ? "Charge table (F9)" : "Complete sale (F9)"}
            </Button>
            <Button variant="secondary" size="lg" className="touch-btn w-full" disabled={!lastSale} onClick={() => setPrintOpen(true)}>
              Receipt / print
            </Button>
          </div>
        </aside>
      </div>

      {printOpen && lastSale ? (
        <div className="receipt-print fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={() => setPrintOpen(false)}>
          <div className={`receipt-paper max-w-full bg-white p-4 text-black ${printProfile}`} onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-lg font-bold">{session.tenantName}</p>
            <p className="text-center text-sm">{session.branchName}</p>
            <p className="text-center text-xs">SokoOS receipt — not an eTIMS fiscal invoice until OSCU/VSCU confirms</p>
            <p className="mt-2 text-sm">{lastSale.receiptNo}</p>
            <p className="text-xs">Served by {session.cashierName}</p>
            <p className="text-xs">{new Date(lastSale.createdAt).toLocaleString()}</p>
            {lastSale.orderType && lastSale.orderType !== "retail" ? (
              <p className="text-xs uppercase">{lastSale.orderType.replace("_", " ")}{lastSale.tableCode ? ` · Table ${lastSale.tableCode}` : ""}</p>
            ) : null}
            {lastSale.customerName ? <p className="text-xs">Customer {lastSale.customerName} {lastSale.customerPhone}</p> : null}
            <hr className="my-2" />
            {printProfile === "a4" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left"><th>Item</th><th>Qty</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {lastSale.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>{l.name}</td>
                      <td>{l.qty}</td>
                      <td className="text-right">{formatMoney(l.lineTotalCents, session.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              lastSale.lines.map((l) => (
                <div key={l.productId} className="flex justify-between text-sm">
                  <span>{l.name} × {l.qty}</span>
                  <span>{formatMoney(l.lineTotalCents, session.currency)}</span>
                </div>
              ))
            )}
            <hr className="my-2" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatMoney(lastSale.totalCents, session.currency)}</span>
            </div>
            <p className="mt-1 text-xs">
              Paid {lastSale.tender}
              {lastSale.tender === "cash"
                ? ` · tendered ${formatMoney(lastSale.cashTenderedCents ?? 0, session.currency)} · change ${formatMoney(lastSale.changeCents ?? 0, session.currency)}`
                : ""}
            </p>
            <p className="mt-3 text-center text-xs">Thank you</p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <select
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                value={printProfile}
                onChange={(e) => setPrintProfile(e.target.value as typeof printProfile)}
              >
                <option value="thermal-80">80mm thermal</option>
                <option value="thermal-58">58mm thermal</option>
                <option value="a4">A4 invoice</option>
              </select>
              <Button onClick={() => window.print()}>Print</Button>
              <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SyncPill({ status, pending }: { status: SyncStatus; pending: number }) {
  const label =
    status === "synced" ? "ONLINE · synced"
      : status === "syncing" ? `SYNCING${pending ? ` · ${pending}` : ""}`
        : status === "offline" ? `OFFLINE${pending ? ` · ${pending} queued` : ""}`
          : status === "error" ? `SYNC_ERROR${pending ? ` · ${pending} queued` : ""}`
            : pending > 0 ? `PENDING · ${pending}` : "IDLE";
  return (
    <span className="rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-2 py-1 font-semibold text-[var(--soko-color-text-muted)]">
      {label}
    </span>
  );
}
