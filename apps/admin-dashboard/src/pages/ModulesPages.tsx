import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell, EmptyState } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { formatMoney, parseMoneyToMinor } from "../lib/money";

function useList<T>(path: string) {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    const res = await apiRequest<T[] | { data: T[] }>(path, { token });
    setRows(Array.isArray(res) ? res : res.data);
  }
  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [token, path]);
  return { rows, error, reload, token };
}

export function BranchesPage() {
  const { rows, error, reload, token } = useList<{ id: string; code: string; name: string; status: string }>("/branches");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/branches", { method: "POST", token, body: { name, code } });
    setName("");
    setCode("");
    await reload();
  }
  return (
    <AppShell title="Branches" description="Each branch keeps its own stock, receipts, and warehouses.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 flex flex-wrap gap-3">
        <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Add branch</Button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--soko-color-text-muted)]"><th className="py-2">Code</th><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-[var(--soko-color-border)]"><td className="py-2">{b.code}</td><td>{b.name}</td><td>{b.status}</td></tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

export function UsersPage() {
  const { rows, error, reload, token } = useList<{ id: string; name: string; email: string; status: string }>("/users");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("ChangeMe123!");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/users", { method: "POST", token, body: { name, email, password } });
    await reload();
  }
  return (
    <AppShell title="Employees" description="Accounts, branch assignment, and role-based access. Backend enforces permissions.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 grid gap-3 md:grid-cols-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Temp password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit">Invite</Button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--soko-color-text-muted)]"><th className="py-2">Name</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-[var(--soko-color-border)]"><td className="py-2">{u.name}</td><td>{u.email}</td><td>{u.status}</td></tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

export function CustomersPage() {
  const { rows, error, reload, token } = useList<{ id: string; name: string; phone?: string; email?: string }>("/customers");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/customers", { method: "POST", token, body: { name, phone } });
    await reload();
  }
  return (
    <AppShell title="Customers" description="Optional at checkout. Walk-in sales stay allowed unless settings require a customer.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 flex gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit">Add</Button>
      </form>
      {!rows.length ? <EmptyState title="No customers" body="POS can create them during checkout." /> : (
        <ul className="text-sm">{rows.map((c) => <li key={c.id} className="border-t border-[var(--soko-color-border)] py-2">{c.name} · {c.phone ?? "no phone"}</li>)}</ul>
      )}
    </AppShell>
  );
}

export function SuppliersPage() {
  const { rows, error, reload, token } = useList<{ id: string; name: string; phone?: string }>("/suppliers");
  const [name, setName] = useState("");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/suppliers", { method: "POST", token, body: { name } });
    await reload();
  }
  return (
    <AppShell title="Suppliers" description="Linked to LPOs. Receiving still posts against the original LPO id.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 flex gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Add supplier</Button>
      </form>
      <ul className="text-sm">{rows.map((s) => <li key={s.id} className="border-t py-2">{s.name}</li>)}</ul>
    </AppShell>
  );
}

export function ExpensesPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const { rows, error, reload } = useList<{
    id: string;
    category: string;
    amountMinor: number;
    notes?: string | null;
    approvalStatus?: string;
    paymentMethod?: string | null;
    occurredAt?: string;
    branch?: { name: string } | null;
  }>("/expenses");
  const { rows: branches } = useList<{ id: string; name: string }>("/branches");
  const [category, setCategory] = useState("UTILITIES");
  const [amount, setAmount] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/expenses", {
      method: "POST",
      token,
      body: {
        branchId: branchId || branches[0]?.id,
        category,
        amountMinor: parseMoneyToMinor(amount),
        paymentMethod,
        notes: notes || undefined,
        approvalStatus: "pending",
      },
    });
    setAmount("");
    setNotes("");
    await reload();
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      await apiRequest(`/expenses/${id}/approve`, { method: "POST", token });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const visible = rows.filter((e) => filter === "all" || (e.approvalStatus ?? "recorded") === filter);
  const totalPending = rows
    .filter((e) => (e.approvalStatus ?? "recorded") === "pending")
    .reduce((s, e) => s + e.amountMinor, 0);
  const totalApproved = rows
    .filter((e) => e.approvalStatus === "approved")
    .reduce((s, e) => s + e.amountMinor, 0);

  return (
    <AppShell title="Expenses" description="Operating costs only — inventory purchases belong on LPOs. Approve pending expenses before they feed financial reports.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-3">
          <p className="text-xs text-[var(--soko-color-text-muted)]">Pending approval</p>
          <p className="font-display text-xl">{formatMoney(totalPending, currency)}</p>
        </div>
        <div className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-3">
          <p className="text-xs text-[var(--soko-color-text-muted)]">Approved</p>
          <p className="font-display text-xl">{formatMoney(totalApproved, currency)}</p>
        </div>
        <div className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-3">
          <p className="text-xs text-[var(--soko-color-text-muted)]">Entries</p>
          <p className="font-display text-xl">{rows.length}</p>
        </div>
      </div>
      <form onSubmit={onCreate} className="mb-4 grid gap-3 md:grid-cols-3">
        <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          {["RENT","UTILITIES","TRANSPORT","SALARIES","MAINTENANCE","SUPPLIES","MARKETING","OTHER"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <Input label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          {["cash","mpesa","card","bank"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Input label="Notes / receipt ref" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit">Record expense</Button>
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        {["all", "pending", "approved", "recorded"].map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${filter === f ? "bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]" : "text-[var(--soko-color-text-muted)]"}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--soko-color-text-muted)]">
            <th className="py-2">Date</th>
            <th>Category</th>
            <th>Branch</th>
            <th>Method</th>
            <th>Status</th>
            <th className="text-right">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((e) => (
            <tr key={e.id} className="border-t border-[var(--soko-color-border)]">
              <td className="py-2">{e.occurredAt ? new Date(e.occurredAt).toLocaleDateString() : "—"}</td>
              <td>
                <div>{e.category}</div>
                {e.notes ? <div className="text-xs text-[var(--soko-color-text-muted)]">{e.notes}</div> : null}
              </td>
              <td>{e.branch?.name ?? "—"}</td>
              <td>{e.paymentMethod ?? "—"}</td>
              <td>{e.approvalStatus ?? "recorded"}</td>
              <td className="text-right">{formatMoney(e.amountMinor, currency)}</td>
              <td className="text-right">
                {(e.approvalStatus === "pending" || e.approvalStatus === "recorded") ? (
                  <Button size="sm" variant="secondary" disabled={busyId === e.id} onClick={() => void approve(e.id)}>
                    Approve
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

export function DeliveriesPage() {
  const { rows, error, reload, token } = useList<{
    id: string; status: string; address?: string | null; phone?: string | null; feeMinor: number; sale?: { receiptNumber: string };
  }>("/deliveries");
  return (
    <AppShell title="Deliveries" description="Fee is stored separately from product revenue. Status history is append-only.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {!rows.length ? <EmptyState title="No deliveries" body="Create a delivery from a completed sale." /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--soko-color-text-muted)]"><th className="py-2">Sale</th><th>Phone</th><th>Status</th><th>Fee</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-[var(--soko-color-border)]">
                <td className="py-2">{d.sale?.receiptNumber}</td>
                <td>{d.phone}</td>
                <td>{d.status}</td>
                <td>{d.feeMinor}</td>
                <td>
                  {["ASSIGNED","DISPATCHED","DELIVERED","CANCELLED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className="mr-2 text-xs text-[var(--soko-color-primary)]"
                      onClick={() => void apiRequest(`/deliveries/${d.id}`, { method: "PATCH", token, body: { status: st } }).then(reload)}
                    >
                      {st}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}

export function MessagesPage() {
  const { rows, error, reload, token } = useList<{ id: string; title: string; body: string; read?: boolean }>("/messages");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/messages", { method: "POST", token, body: { title, body, audience: "all" } });
    setTitle("");
    setBody("");
    await reload();
  }
  return (
    <AppShell title="Messages" description="Announcements stay inside the tenant. Employees mark them read.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={send} className="mb-4 space-y-2">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit">Publish</Button>
      </form>
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="rounded-md border border-[var(--soko-color-border)] p-3">
            <p className="font-semibold">{m.title} {m.read ? "" : "· unread"}</p>
            <p className="text-sm text-[var(--soko-color-text-muted)]">{m.body}</p>
            {!m.read ? (
              <button type="button" className="mt-1 text-xs text-[var(--soko-color-primary)]" onClick={() => void apiRequest(`/messages/${m.id}/read`, { method: "POST", token }).then(reload)}>
                Mark read
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

export function SimplePage({
  title,
  description,
  path,
  columns,
}: {
  title: string;
  description: string;
  path: string;
  columns: string[];
}) {
  const { rows, error } = useList<Record<string, unknown>>(path);
  return (
    <AppShell title={title} description={description}>
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {!rows.length ? <EmptyState title="Nothing here yet" body={description} /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--soko-color-text-muted)]">{columns.map((c) => <th key={c} className="py-2">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={String(row.id ?? i)} className="border-t border-[var(--soko-color-border)]">
                {columns.map((c) => <td key={c} className="py-2">{String(row[c] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}

export function CategoriesPage() {
  const { rows, error, reload, token } = useList<{ id: string; name: string; status: string }>("/categories");
  const [name, setName] = useState("");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/categories", { method: "POST", token, body: { name } });
    setName("");
    await reload();
  }
  return (
    <AppShell title="Categories" description="Product grouping used on POS chips and reports.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 flex gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Add category</Button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--soko-color-text-muted)]"><th className="py-2">Name</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--soko-color-border)]"><td className="py-2">{r.name}</td><td>{r.status}</td></tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
export function BrandsPage() {
  const { rows, error, reload, token } = useList<{ id: string; name: string; status: string }>("/brands");
  const [name, setName] = useState("");
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await apiRequest("/brands", { method: "POST", token, body: { name } });
    setName("");
    await reload();
  }
  return (
    <AppShell title="Brands" description="Optional brand on each SKU.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <form onSubmit={onCreate} className="mb-4 flex gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Add brand</Button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--soko-color-text-muted)]"><th className="py-2">Name</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--soko-color-border)]"><td className="py-2">{r.name}</td><td>{r.status}</td></tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
export function RolesPage() {
  const { rows, error } = useList<{
    id: string;
    key: string;
    name: string;
    rolePermissions?: Array<{ permission: { key: string } }>;
  }>("/roles");
  return (
    <AppShell title="Roles" description="Permission templates. Backend enforces every key — hiding a button is not enough.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="space-y-4">
        {rows.map((role) => (
          <article key={role.id} className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] p-4">
            <h2 className="font-display text-lg">{role.name} <span className="text-sm text-[var(--soko-color-text-muted)]">({role.key})</span></h2>
            <p className="mt-2 text-xs text-[var(--soko-color-text-muted)]">
              {(role.rolePermissions ?? []).map((rp) => rp.permission.key).join(", ") || "Permissions loaded with role detail — assign via API PUT /roles/:id/permissions"}
            </p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
export { CreditNotesPage as ReturnsPage } from "./CreditNotesPage";
export { TransfersPage } from "./TransfersPage";
export function ReportsPage() {
  const token = useAuthStore((s) => s.accessToken);
  return (
    <AppShell
      title="Reports"
      description="Exports use completed sales only. CSV is the Excel-compatible format."
      action={
        <Button
          onClick={() => {
            void apiRequest<string>("/reports/export.csv", { token, raw: true }).then((csv) => {
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "sokoos-sales.csv";
              a.click();
            });
          }}
        >
          Export CSV / Excel
        </Button>
      }
    >
      <p className="text-sm text-[var(--soko-color-text-muted)]">Open Dashboard for KPIs. This export is branch-filterable via query params later.</p>
    </AppShell>
  );
}
export function IntelligencePage() {
  const token = useAuthStore((s) => s.accessToken);
  const currency = useAuthStore((s) => s.tenant?.currency) ?? "KES";
  const [dash, setDash] = useState<{
    today: { salesTotalMinor: number; salesCount: number };
    week: { salesTotalMinor: number; salesCount: number };
    month: { salesTotalMinor: number; salesCount: number };
    topProducts: Array<{ nameSnapshot: string; _sum: { quantity: number | null; lineTotalMinor: number | null } }>;
    paymentBreakdown: Array<{ method: string; _sum: { amountMinor: number | null } }>;
  } | null>(null);
  useEffect(() => {
    void apiRequest<NonNullable<typeof dash>>("/reports/dashboard", { token }).then(setDash).catch(() => undefined);
  }, [token]);
  const periods = dash
    ? [
        { label: "Today", value: dash.today.salesTotalMinor, count: dash.today.salesCount },
        { label: "Week", value: dash.week.salesTotalMinor, count: dash.week.salesCount },
        { label: "Month", value: dash.month.salesTotalMinor, count: dash.month.salesCount },
      ]
    : [];
  const max = Math.max(...periods.map((p) => p.value), 1);
  return (
    <AppShell title="Business intelligence" description="Completed cloud sales only — offline tickets are not double-counted after sync.">
      {!dash ? (
        <p className="text-sm text-[var(--soko-color-text-muted)]">Loading…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-xl">Sales periods</h2>
            <ul className="mt-4 space-y-3">
              {periods.map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between text-sm">
                    <span>{p.label}</span>
                    <span>{formatMoney(p.value, currency)} · {p.count} txns</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-[var(--soko-color-surface-muted)]">
                    <div className="h-full rounded-full bg-[var(--soko-color-accent)]" style={{ width: `${Math.round((p.value / max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl">Top products</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {dash.topProducts.map((p) => (
                <li key={p.nameSnapshot} className="flex justify-between">
                  <span>{p.nameSnapshot}</span>
                  <span className="text-[var(--soko-color-text-muted)]">{formatMoney(p._sum.lineTotalMinor ?? 0, currency)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
export function IntegrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [health, setHealth] = useState<
    Array<{ provider: string; configured: boolean; mode: string; notes: string; lastError: string | null }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<typeof health>("/integrations/health", { token })
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function markConfigured(provider: "mpesa" | "etims" | "printer") {
    setError(null);
    setInfo(null);
    const body =
      provider === "mpesa"
        ? { mpesa: { enabled: true, mode: "sandbox", shortcode: "174379", consumerKeySet: true, consumerSecretSet: true, passkeySet: true } }
        : provider === "etims"
          ? { etims: { enabled: true, mode: "sandbox", pin: "P000000000X" } }
          : { printer: { enabled: true, defaultTarget: "usb:pos-80" } };
    const data = await apiRequest<typeof health>("/integrations/settings", {
      method: "PATCH",
      token,
      body,
    });
    setHealth(data);
    setInfo(
      `${provider} settings saved. Live confirmation still requires verified provider callbacks — never faked.`,
    );
  }

  return (
    <AppShell title="Integrations" description="M-Pesa, eTIMS, printers, and notifications — safe boundaries; no fake fiscal or payment confirmations.">
      {error ? <p className="mb-2 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {info ? <p className="mb-2 text-sm text-emerald-700">{info}</p> : null}
      <ul className="space-y-3">
        {health.map((h) => (
          <li key={h.provider} className="rounded-lg border border-[var(--soko-color-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold capitalize">{h.provider}</p>
                <p className="text-xs text-[var(--soko-color-text-muted)]">
                  {h.configured ? "configured" : "not configured"} · {h.mode}
                </p>
                <p className="mt-2 text-sm">{h.notes}</p>
                {h.lastError ? <p className="mt-1 text-xs text-[var(--soko-color-danger)]">{h.lastError}</p> : null}
              </div>
              {(["mpesa", "etims", "printer"] as const).includes(h.provider as "mpesa") ? (
                <Button type="button" variant="secondary" onClick={() => void markConfigured(h.provider as "mpesa" | "etims" | "printer")}>
                  Save sandbox flags
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!health.length ? <li className="text-sm text-[var(--soko-color-text-muted)]">Loading integration health…</li> : null}
      </ul>
    </AppShell>
  );
}
export function DevicesPage() {
  return <SimplePage title="Devices" description="Registered POS terminals, last seen, sync cursor." path="/auth/devices" columns={["name", "status"]} />;
}
export function NotificationsPage() {
  return <SimplePage title="Notifications" description="Per-user inbox: low stock, sync failures, sales." path="/notifications" columns={["type", "body"]} />;
}
