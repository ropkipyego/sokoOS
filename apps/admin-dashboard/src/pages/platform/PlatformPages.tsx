import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Input } from "@sokoos/ui";
import { BUSINESS_TYPES, defaultModulesForTypes, type BusinessType } from "@sokoos/types";
import { PlatformShell } from "../../components/PlatformShell";
import { apiRequest } from "../../api/client";
import { useAuthStore } from "../../stores/auth";

type Overview = {
  totals: Record<string, number>;
  attention: Record<string, number>;
  recentlyOnboarded: Array<{ id: string; name: string; slug: string; status: string; createdAt: string }>;
  pendingRegistrations: Array<{
    id: string;
    businessName: string;
    preferredSlug: string;
    status: string;
    email: string;
    createdAt: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  businessTypes: unknown;
  modulesEnabled: unknown;
  createdAt: string;
  _count?: { branches: number; users: number; devices: number; departments: number };
};

const QUICK_LINKS = [
  { to: "/platform/registrations", label: "Review registrations" },
  { to: "/platform/onboarding", label: "Onboard a client" },
  { to: "/platform/billing", label: "Plans & billing" },
  { to: "/platform/support", label: "Support queue" },
  { to: "/platform/health", label: "Monitoring" },
  { to: "/platform/audit", label: "Audit log" },
] as const;

export function PlatformOverviewPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<Overview>("/platform/overview", { token })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const attentionItems = data
    ? Object.entries(data.attention).filter(([, v]) => v > 0)
    : [];

  return (
    <PlatformShell
      title="Platform overview"
      description="Operate the full client lifecycle from one control centre — businesses, domains, billing, support, and security."
    >
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}

      {attentionItems.length ? (
        <section className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Needs attention
          </h2>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm">
            {attentionItems.map(([k, v]) => (
              <li key={k} className="rounded-md bg-[var(--soko-color-surface)] px-3 py-1.5">
                <span className="text-[var(--soko-color-text-muted)]">{k}: </span>
                <span className="font-semibold tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to as never}
            className="rounded-md border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-3 py-2 text-sm font-medium hover:border-[var(--soko-color-primary)]"
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data
          ? Object.entries(data.totals).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--soko-color-text-muted)]">{k}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
              </div>
            ))
          : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Pending registrations</h2>
          <ul className="mt-2 divide-y divide-[var(--soko-color-border)] rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
            {(data?.pendingRegistrations ?? []).length === 0 ? (
              <li className="px-4 py-3 text-sm text-[var(--soko-color-text-muted)]">Queue clear</li>
            ) : (
              (data?.pendingRegistrations ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.businessName}</p>
                    <p className="text-[var(--soko-color-text-muted)]">
                      {r.preferredSlug} · {r.status}
                    </p>
                  </div>
                  <Link to={"/platform/registrations" as never} className="text-[var(--soko-color-primary)]">
                    Review
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Recently onboarded</h2>
          <ul className="mt-2 divide-y divide-[var(--soko-color-border)] rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
            {(data?.recentlyOnboarded ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-[var(--soko-color-text-muted)]">
                    {t.slug} · {t.status}
                  </p>
                </div>
                <Link
                  className="text-[var(--soko-color-primary)]"
                  to={`/platform/tenants/$tenantId`}
                  params={{ tenantId: t.id }}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Recent platform audit</h2>
      <ul className="mt-2 divide-y divide-[var(--soko-color-border)] rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
        {(data?.recentAudit ?? []).map((a) => (
          <li key={a.id} className="flex justify-between px-4 py-2 text-sm">
            <span className="font-mono text-xs">{a.action}</span>
            <span className="text-xs text-[var(--soko-color-text-muted)]">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </PlatformShell>
  );
}

export function PlatformTenantsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void apiRequest<TenantRow[]>("/platform/tenants", { token }).then(setRows).catch(() => setRows([]));
  }, [token]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(needle) || r.slug.includes(needle));
  }, [rows, q]);

  return (
    <PlatformShell title="Client businesses" description="Every tenant is isolated. Operators manage lifecycle — never share one tenant's data into another.">
      <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Branches</th>
              <th className="px-3 py-2">Users</th>
              <th className="px-3 py-2">Depts</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-[var(--soko-color-text-muted)]">{t.slug}</p>
                </td>
                <td className="px-3 py-2">{t.status}</td>
                <td className="px-3 py-2">{t._count?.branches ?? "—"}</td>
                <td className="px-3 py-2">{t._count?.users ?? "—"}</td>
                <td className="px-3 py-2">{t._count?.departments ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/platform/tenants/$tenantId`} params={{ tenantId: t.id }} className="text-[var(--soko-color-primary)]">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformTenantDetailPage({ tenantId }: { tenantId: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState("starter");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const data = await apiRequest<Record<string, unknown>>(`/platform/tenants/${tenantId}`, { token });
    setTenant(data);
  }

  useEffect(() => {
    void reload().catch((e: Error) => setMsg(e.message));
  }, [tenantId, token]);

  async function setStatus(status: "active" | "suspended") {
    setBusy(true);
    try {
      await apiRequest(`/platform/tenants/${tenantId}/status`, { method: "PATCH", token, body: { status } });
      setMsg(`Status set to ${status}`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function ensureDomain() {
    setBusy(true);
    try {
      await apiRequest(`/platform/domains/tenants/${tenantId}/primary`, { method: "POST", token });
      setMsg("Primary subdomain ensured");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Domain failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignPlan() {
    setBusy(true);
    try {
      await apiRequest(`/platform/tenants/${tenantId}/subscription`, {
        method: "POST",
        token,
        body: { planCode, activate: true },
      });
      setMsg(`Plan ${planCode} assigned and activated`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  if (!tenant) {
    return (
      <PlatformShell title="Business">
        <p className="text-sm text-[var(--soko-color-text-muted)]">{msg ?? "Loading…"}</p>
      </PlatformShell>
    );
  }

  const users = (tenant.users as Array<{ id: string; email: string; name: string; status: string }>) ?? [];
  const devices = (tenant.devices as Array<{ id: string; name: string; status: string }>) ?? [];
  const branches = (tenant.branches as Array<{ id: string; name: string; code: string }>) ?? [];
  const departments = (tenant.departments as Array<{ id: string; name: string; code: string; type: string }>) ?? [];
  const counts = (tenant._count as Record<string, number>) ?? {};

  return (
    <PlatformShell title={String(tenant.name)} description={`Slug ${tenant.slug} · status ${tenant.status} · isolated tenant`}>
      {msg ? <p className="mb-3 text-sm text-[var(--soko-color-accent)]">{msg}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} variant="secondary" onClick={() => void setStatus("active")}>
          Activate
        </Button>
        <Button size="sm" disabled={busy} variant="secondary" onClick={() => void setStatus("suspended")}>
          Suspend
        </Button>
        <Button size="sm" disabled={busy} variant="secondary" onClick={() => void ensureDomain()}>
          Ensure subdomain
        </Button>
        <Link
          to={"/platform/support" as never}
          className="rounded-md border border-[var(--soko-color-border)] px-3 py-1.5 text-sm"
        >
          Support
        </Link>
        <Link
          to={"/platform/domains" as never}
          className="rounded-md border border-[var(--soko-color-border)] px-3 py-1.5 text-sm"
        >
          Domains
        </Link>
      </div>

      <div className="mb-6 grid max-w-xl gap-2 rounded-lg border border-[var(--soko-color-border)] p-4">
        <p className="text-sm font-medium">Assign subscription plan</p>
        <Input label="Plan code" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        <Button disabled={busy} onClick={() => void assignPlan()}>
          Assign & activate plan
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[var(--soko-color-border)] p-3">
            <p className="text-xs uppercase text-[var(--soko-color-text-muted)]">{k}</p>
            <p className="text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--soko-color-border)] p-4">
          <h2 className="font-semibold">Users</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {users.map((u) => (
              <li key={u.id}>
                {u.name} · {u.email} · {u.status}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-[var(--soko-color-border)] p-4">
          <h2 className="font-semibold">Devices</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {devices.map((d) => (
              <li key={d.id}>
                {d.name} · {d.status}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-[var(--soko-color-border)] p-4">
          <h2 className="font-semibold">Branches</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {branches.map((b) => (
              <li key={b.id}>
                {b.name} ({b.code})
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-[var(--soko-color-border)] p-4">
          <h2 className="font-semibold">Departments</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {departments.map((d) => (
              <li key={d.id}>
                {d.name} ({d.code}) · {d.type}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Raw profile JSON</summary>
        <pre className="mt-2 overflow-auto rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4 text-xs">
          {JSON.stringify(
            {
              status: tenant.status,
              businessTypes: tenant.businessTypes,
              modulesEnabled: tenant.modulesEnabled,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </PlatformShell>
  );
}

const STEPS = [
  "Business information",
  "Business profile",
  "Branch setup",
  "Departments",
  "Administrator",
  "Operational settings",
  "Devices",
  "Review & activate",
];

export function PlatformOnboardingPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState<Record<string, unknown>>({
    business: { currency: "KES", timezone: "Africa/Nairobi", locale: "en-KE" },
    profile: { businessTypes: ["retail"] as BusinessType[] },
    branch: { name: "Main", code: "MAIN" },
    departments: [{ code: "OPS", name: "Operations", type: "retail" }],
    admin: {},
    operational: { negativeStockPolicy: "block" },
    devices: [{ name: "Front POS" }],
  });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ensureDraft() {
    if (draftId) return draftId;
    const created = await apiRequest<{ id: string }>("/platform/onboarding/drafts", { method: "POST", token });
    setDraftId(created.id);
    return created.id;
  }

  async function save(nextStep: number) {
    setBusy(true);
    setError(null);
    try {
      const id = await ensureDraft();
      const types = ((payload.profile as { businessTypes?: BusinessType[] })?.businessTypes ?? ["retail"]) as BusinessType[];
      const withModules = {
        ...payload,
        profile: {
          ...(payload.profile as object),
          modulesEnabled: defaultModulesForTypes(types),
        },
      };
      setPayload(withModules);
      await apiRequest(`/platform/onboarding/drafts/${id}`, {
        method: "PATCH",
        token,
        body: { step: nextStep, payload: withModules },
      });
      setStep(nextStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const id = await ensureDraft();
      await apiRequest(`/platform/onboarding/drafts/${id}`, {
        method: "PATCH",
        token,
        body: { step: 8, payload },
      });
      const data = await apiRequest<Record<string, unknown>>(`/platform/onboarding/drafts/${id}/activate`, {
        method: "POST",
        token,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  const business = (payload.business ?? {}) as Record<string, string>;
  const profile = (payload.profile ?? {}) as { businessTypes?: BusinessType[] };
  const branch = (payload.branch ?? {}) as Record<string, string>;
  const admin = (payload.admin ?? {}) as Record<string, string>;
  const departments = (payload.departments ?? []) as Array<{ code: string; name: string; type: string }>;

  return (
    <PlatformShell title="Client onboarding" description="Multi-step wizard with draft resume. Activation is transactional — no half-created tenants.">
      {result ? (
        <div className="space-y-3 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
          <p className="font-semibold text-[var(--soko-color-primary)]">Business activated</p>
          <p className="text-sm">Slug: {String((result.tenant as { slug?: string })?.slug)}</p>
          <p className="text-sm break-all">
            One-time activation token (store securely — not logged):{" "}
            <code className="text-xs">{String(result.activationToken)}</code>
          </p>
          <p className="text-xs text-[var(--soko-color-text-muted)]">{String(result.activationHint)}</p>
          <Link to={"/platform/tenants" as never} className="text-[var(--soko-color-primary)] underline">
            View clients
          </Link>
        </div>
      ) : (
        <>
          <ol className="mb-4 flex flex-wrap gap-2 text-xs">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`rounded-full px-3 py-1 ${
                  step === i + 1
                    ? "bg-[var(--soko-color-primary)] text-white"
                    : "bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]"
                }`}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>
          {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}

          {step === 1 ? (
            <div className="grid max-w-xl gap-3">
              <Input label="Business name" value={business.name ?? ""} onChange={(e) => setPayload({ ...payload, business: { ...business, name: e.target.value } })} />
              <Input label="Legal name" value={business.legalName ?? ""} onChange={(e) => setPayload({ ...payload, business: { ...business, legalName: e.target.value } })} />
              <Input label="Slug" value={business.slug ?? ""} onChange={(e) => setPayload({ ...payload, business: { ...business, slug: e.target.value.toLowerCase() } })} />
              <Input label="Email" value={business.email ?? ""} onChange={(e) => setPayload({ ...payload, business: { ...business, email: e.target.value } })} />
              <Input label="Phone" value={business.phone ?? ""} onChange={(e) => setPayload({ ...payload, business: { ...business, phone: e.target.value } })} />
              <Input label="Currency" value={business.currency ?? "KES"} onChange={(e) => setPayload({ ...payload, business: { ...business, currency: e.target.value } })} />
              <Button disabled={busy} onClick={() => void save(2)}>Continue</Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="max-w-xl space-y-3">
              <p className="text-sm text-[var(--soko-color-text-muted)]">Select one or more industry profiles.</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((t) => {
                  const selected = profile.businessTypes?.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`rounded-md border px-3 py-2 text-sm capitalize ${
                        selected
                          ? "border-[var(--soko-color-primary)] bg-[var(--soko-color-primary-muted)]"
                          : "border-[var(--soko-color-border)]"
                      }`}
                      onClick={() => {
                        const cur = new Set(profile.businessTypes ?? []);
                        if (cur.has(t)) cur.delete(t);
                        else cur.add(t);
                        const next = [...cur] as BusinessType[];
                        setPayload({
                          ...payload,
                          profile: { businessTypes: next.length ? next : ["retail"] },
                        });
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button disabled={busy} onClick={() => void save(3)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid max-w-xl gap-3">
              <Input label="Branch name" value={branch.name ?? ""} onChange={(e) => setPayload({ ...payload, branch: { ...branch, name: e.target.value } })} />
              <Input label="Branch code" value={branch.code ?? ""} onChange={(e) => setPayload({ ...payload, branch: { ...branch, code: e.target.value } })} />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <Button disabled={busy} onClick={() => void save(4)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="max-w-xl space-y-3">
              {departments.map((d, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Input label="Code" value={d.code} onChange={(e) => {
                    const next = [...departments];
                    next[i] = { ...d, code: e.target.value };
                    setPayload({ ...payload, departments: next });
                  }} />
                  <Input label="Name" value={d.name} onChange={(e) => {
                    const next = [...departments];
                    next[i] = { ...d, name: e.target.value };
                    setPayload({ ...payload, departments: next });
                  }} />
                  <Input label="Type" value={d.type} onChange={(e) => {
                    const next = [...departments];
                    next[i] = { ...d, type: e.target.value };
                    setPayload({ ...payload, departments: next });
                  }} />
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPayload({
                    ...payload,
                    departments: [...departments, { code: `D${departments.length + 1}`, name: "New dept", type: "retail" }],
                  })
                }
              >
                Add department
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                <Button disabled={busy} onClick={() => void save(5)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid max-w-xl gap-3">
              <Input label="Admin name" value={admin.name ?? ""} onChange={(e) => setPayload({ ...payload, admin: { ...admin, name: e.target.value } })} />
              <Input label="Admin email" value={admin.email ?? ""} onChange={(e) => setPayload({ ...payload, admin: { ...admin, email: e.target.value } })} />
              <Input label="Admin phone" value={admin.phone ?? ""} onChange={(e) => setPayload({ ...payload, admin: { ...admin, phone: e.target.value } })} />
              <p className="text-xs text-[var(--soko-color-text-muted)]">No password is chosen here. A one-time activation token is issued on activate.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
                <Button disabled={busy} onClick={() => void save(6)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 6 || step === 7 ? (
            <div className="max-w-xl space-y-3">
              <p className="text-sm">Defaults applied for inventory policy and a starter POS device. You can refine later in Configuration Centre.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>
                <Button disabled={busy} onClick={() => void save(step === 6 ? 7 : 8)}>Continue</Button>
              </div>
            </div>
          ) : null}

          {step === 8 ? (
            <div className="max-w-xl space-y-3">
              <pre className="overflow-auto rounded-lg border p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(7)}>Back</Button>
                <Button disabled={busy} onClick={() => void activate()}>{busy ? "Activating…" : "Activate business"}</Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PlatformShell>
  );
}

type RegistrationRow = {
  id: string;
  businessName: string;
  preferredSlug: string;
  contactName: string;
  email: string;
  status: string;
  emailVerifiedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  resultingTenantId: string | null;
};

export function PlatformRegistrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteOnce, setInviteOnce] = useState<string | null>(null);

  const load = () => {
    void apiRequest<RegistrationRow[]>("/platform/registrations", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const review = async (id: string, action: "approve" | "reject" | "request_info") => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/platform/registrations/${id}/review`, {
        method: "POST",
        token,
        body: { action },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };

  const provision = async (id: string) => {
    setBusy(true);
    setError(null);
    setInviteOnce(null);
    try {
      const data = await apiRequest<{
        registration: RegistrationRow;
        provision: { tenantId: string; slug: string; activationToken: string; domainHostname: string; reused: boolean };
      }>(`/platform/registrations/${id}/provision`, { method: "POST", token, body: {} });
      if (data.provision.activationToken) {
        setInviteOnce(
          `Provisioned ${data.provision.slug} → ${data.provision.domainHostname}. Activation token (once): ${data.provision.activationToken}`,
        );
      } else {
        setInviteOnce(`Reused provision for ${data.provision.slug} (token not re-issued).`);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provision failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Registrations"
      description="Self-registration queue. Approve only after email verification. Provisioning is idempotent."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {inviteOnce ? (
        <p className="mb-3 break-all rounded-md border border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] p-3 text-xs">
          {inviteOnce}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2">{r.businessName}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.preferredSlug}</td>
                <td className="px-3 py-2">
                  {r.contactName}
                  <div className="text-xs text-[var(--soko-color-text-muted)]">{r.email}</div>
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.emailVerifiedAt ? "verified" : "pending"}</td>
                <td className="space-x-2 px-3 py-2">
                  <button type="button" disabled={busy} className="text-[var(--soko-color-primary)]" onClick={() => void review(r.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" disabled={busy} className="text-[var(--soko-color-text-muted)]" onClick={() => void review(r.id, "request_info")}>
                    Info
                  </button>
                  <button type="button" disabled={busy} className="text-[var(--soko-color-danger)]" onClick={() => void review(r.id, "reject")}>
                    Reject
                  </button>
                  <button type="button" disabled={busy} className="text-[var(--soko-color-primary)]" onClick={() => void provision(r.id)}>
                    Provision
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

type DomainRow = {
  id: string;
  hostname: string;
  kind: string;
  status: string;
  isPrimary: boolean;
  tlsStatus: string;
  tenant: { id: string; name: string; slug: string; status: string };
};

export function PlatformDomainsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [reserved, setReserved] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customTenantId, setCustomTenantId] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [verifyTokenOnce, setVerifyTokenOnce] = useState<string | null>(null);

  const load = () => {
    void apiRequest<DomainRow[]>(`/platform/domains${q ? `?q=${encodeURIComponent(q)}` : ""}`, { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
    void apiRequest<string[]>("/platform/domains/reserved", { token })
      .then(setReserved)
      .catch(() => setReserved([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, [token]);

  const backfill = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/platform/domains/backfill", { method: "POST", token });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  };

  const assignCustom = async () => {
    if (!customTenantId.trim() || !customHost.trim()) return;
    setBusy(true);
    setError(null);
    setVerifyTokenOnce(null);
    try {
      const data = await apiRequest<{
        domain: DomainRow;
        verificationToken: string;
        txtRecordHint: string;
      }>(`/platform/domains/tenants/${customTenantId.trim()}/custom`, {
        method: "POST",
        token,
        body: { hostname: customHost.trim() },
      });
      setVerifyTokenOnce(
        `TXT ${data.txtRecordHint} = ${data.verificationToken} (shown once — paste into verify when DNS is ready)`,
      );
      setCustomHost("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: "active" | "suspended" | "removed") => {
    setBusy(true);
    try {
      await apiRequest(`/platform/domains/${id}/status`, { method: "PATCH", token, body: { status } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Domains"
      description="Hostname → tenant mapping. A hostname is never authorization; JWT and membership still apply."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {verifyTokenOnce ? (
        <p className="mb-3 rounded-md border border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] p-3 text-xs break-all">
          {verifyTokenOnce}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={() => load()}>
          Search
        </Button>
        <Button disabled={busy} onClick={() => void backfill()}>
          Backfill primary subdomains
        </Button>
      </div>
      <div className="mb-6 grid max-w-xl gap-2 rounded-lg border border-[var(--soko-color-border)] p-4">
        <p className="text-sm font-medium">Assign custom domain (pending verification)</p>
        <Input label="Tenant ID" value={customTenantId} onChange={(e) => setCustomTenantId(e.target.value)} />
        <Input label="Hostname" value={customHost} onChange={(e) => setCustomHost(e.target.value)} />
        <Button disabled={busy} onClick={() => void assignCustom()}>
          Create pending custom domain
        </Button>
        <p className="text-xs text-[var(--soko-color-text-muted)]">
          DNS/TLS are not marked provisioned until verified with evidence. Do not claim success without checks.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Hostname</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">TLS</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2 font-mono text-xs">
                  {d.hostname}
                  {d.isPrimary ? " · primary" : ""}
                </td>
                <td className="px-3 py-2">
                  {d.tenant.name}{" "}
                  <span className="text-[var(--soko-color-text-muted)]">({d.tenant.slug})</span>
                </td>
                <td className="px-3 py-2">{d.kind}</td>
                <td className="px-3 py-2">{d.status}</td>
                <td className="px-3 py-2">{d.tlsStatus}</td>
                <td className="px-3 py-2 space-x-2">
                  {d.status !== "active" ? (
                    <button type="button" className="text-[var(--soko-color-primary)]" onClick={() => void setStatus(d.id, "active")}>
                      Activate
                    </button>
                  ) : null}
                  {d.status !== "suspended" ? (
                    <button type="button" className="text-[var(--soko-color-text-muted)]" onClick={() => void setStatus(d.id, "suspended")}>
                      Suspend
                    </button>
                  ) : null}
                  <button type="button" className="text-[var(--soko-color-danger)]" onClick={() => void setStatus(d.id, "removed")}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-medium">Reserved slugs ({reserved.length})</summary>
        <p className="mt-2 text-[var(--soko-color-text-muted)]">{reserved.join(", ")}</p>
      </details>
    </PlatformShell>
  );
}

type EmailRow = {
  id: string;
  templateKey: string;
  toEmail: string;
  subject: string;
  status: string;
  provider: string;
  attemptCount: number;
  lastError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  priceMinor: number;
  currency: string;
  interval: string;
  branchLimit: number | null;
  userLimit: number | null;
  isPublic: boolean;
};

type SubRow = {
  id: string;
  tenantId: string;
  status: string;
  plan: { code: string; name: string };
};

export function PlatformBillingPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [planCode, setPlanCode] = useState("starter");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    void apiRequest<PlanRow[]>("/platform/plans", { token }).then(setPlans).catch((e: Error) => setError(e.message));
    void apiRequest<SubRow[]>("/platform/subscriptions", { token }).then(setSubs).catch(() => setSubs([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const seed = async () => {
    setBusy(true);
    try {
      await apiRequest("/platform/plans/seed-defaults", { method: "POST", token });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!tenantId.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/platform/tenants/${tenantId.trim()}/subscription`, {
        method: "POST",
        token,
        body: { planCode, activate: true },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Plans & subscriptions"
      description="Configurable plans drive public pricing and entitlements. Manual payments require explicit confirmation — gateways never invent success."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void seed()}>
          Seed default plans
        </Button>
      </div>
      <div className="mb-6 grid max-w-xl gap-2 rounded-lg border border-[var(--soko-color-border)] p-4">
        <p className="text-sm font-medium">Assign plan to tenant</p>
        <Input label="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <Input label="Plan code" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        <Button disabled={busy} onClick={() => void assign()}>
          Assign & activate
        </Button>
      </div>
      <h2 className="mb-2 font-semibold">Plans</h2>
      <ul className="mb-6 divide-y rounded-lg border border-[var(--soko-color-border)]">
        {plans.map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              <strong>{p.name}</strong> ({p.code}) · {(p.priceMinor / 100).toLocaleString()} {p.currency}/{p.interval}
            </span>
            <span className="text-[var(--soko-color-text-muted)]">
              branches {p.branchLimit ?? "∞"} · users {p.userLimit ?? "∞"}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mb-2 font-semibold">Subscriptions</h2>
      <ul className="divide-y rounded-lg border border-[var(--soko-color-border)]">
        {subs.map((s) => (
          <li key={s.id} className="px-4 py-3 text-sm">
            {s.plan.name} · {s.status} · tenant {s.tenantId.slice(0, 8)}…
          </li>
        ))}
      </ul>
    </PlatformShell>
  );
}

export function PlatformEmailPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    void apiRequest<EmailRow[]>("/platform/email", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const processQueue = async () => {
    setBusy(true);
    try {
      await apiRequest("/platform/email/process", { method: "POST", token });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Process failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Email centre"
      description="Outbox statuses. Provider acceptance is recorded as sent — delivered only with provider evidence."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <Button disabled={busy} className="mb-4" onClick={() => void processQueue()}>
        Process queue
      </Button>
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2 font-mono text-xs">{r.templateKey}</td>
                <td className="px-3 py-2">{r.toEmail}</td>
                <td className="px-3 py-2">{r.subject}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.provider}</td>
                <td className="px-3 py-2 tabular-nums">{r.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformHealthPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [ops, setOps] = useState<{
    overall: string;
    components: Record<string, string>;
    counters: Record<string, number>;
    ts: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<NonNullable<typeof ops>>("/platform/ops", { token })
      .then(setOps)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <PlatformShell title="Monitoring" description="Real operational evidence only. No passwords, tokens, or payment secrets.">
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {ops ? (
        <>
          <p className="mb-4 text-lg font-semibold capitalize">Overall: {ops.overall}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ops.components).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[var(--soko-color-border)] p-4">
                <p className="text-xs uppercase text-[var(--soko-color-text-muted)]">{k}</p>
                <p className="mt-1 font-semibold capitalize">{v}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-semibold">Counters</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(ops.counters).map(([k, v]) => (
              <li key={k}>
                {k}: <span className="tabular-nums font-medium">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--soko-color-text-muted)]">As of {ops.ts}</p>
        </>
      ) : null}
    </PlatformShell>
  );
}

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  tenantId: string | null;
  category: string;
  _count?: { messages: number };
};

export function PlatformSupportPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiRequest<TicketRow[]>("/platform/support/tickets", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async () => {
    try {
      await apiRequest("/platform/support/tickets", {
        method: "POST",
        token,
        body: { subject, body, tenantId: tenantId || undefined },
      });
      setSubject("");
      setBody("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <PlatformShell
      title="Support centre"
      description="Central tickets. Internal notes are never exposed on tenant endpoints."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-6 grid max-w-xl gap-2 rounded-lg border border-[var(--soko-color-border)] p-4">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input label="Body" value={body} onChange={(e) => setBody(e.target.value)} />
        <Input label="Tenant ID (optional)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <Button onClick={() => void create()}>Create ticket</Button>
      </div>
      <ul className="divide-y rounded-lg border border-[var(--soko-color-border)]">
        {rows.map((t) => (
          <li key={t.id} className="px-4 py-3 text-sm">
            <strong>{t.subject}</strong> · {t.status} · {t.priority} · msgs {t._count?.messages ?? 0}
          </li>
        ))}
      </ul>
    </PlatformShell>
  );
}
