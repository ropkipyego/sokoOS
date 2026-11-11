import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Input } from "@sokoos/ui";
import { PlatformShell } from "../../components/PlatformShell";
import { apiRequest } from "../../api/client";
import { useAuthStore } from "../../stores/auth";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export function PlatformUsersPage() {
  const token = useToken();
  const [rows, setRows] = useState<
    Array<{ id: string; email: string; name: string; status: string; roles: string[] }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    void apiRequest<typeof rows>("/platform/users/platform", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await apiRequest(`/platform/users/platform/${id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Platform users"
      description="SokoOS operator accounts only (null tenant). Least-privilege roles stay separate from tenant permissions."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.roles.join(", ") || "—"}</td>
                <td className="px-3 py-2">{u.status}</td>
                <td className="space-x-2 px-3 py-2">
                  {u.status !== "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="text-[var(--soko-color-primary)]"
                      onClick={() => void setStatus(u.id, "active")}
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="text-[var(--soko-color-danger)]"
                      onClick={() => void setStatus(u.id, "disabled")}
                    >
                      Disable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformTenantUsersPage() {
  const token = useToken();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      email: string;
      name: string;
      status: string;
      tenantSlug?: string;
      tenantName?: string;
      tenantStatus?: string;
      tenantId: string | null;
      roles: string[];
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiRequest<typeof rows>(
      `/platform/users/tenants${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      { token },
    )
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PlatformShell
      title="Tenant users overview"
      description="Cross-tenant identity directory for support and audit. Opening a business still requires scoped authorization — this is not a data-plane bypass."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input label="Search email, name, or slug" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={() => load()}>
          Search
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-[var(--soko-color-text-muted)]">{u.email}</p>
                </td>
                <td className="px-3 py-2">
                  {u.tenantName}{" "}
                  <span className="text-[var(--soko-color-text-muted)]">({u.tenantSlug})</span>
                  <div className="text-xs">{u.tenantStatus}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{u.roles.join(", ") || "—"}</td>
                <td className="px-3 py-2">{u.status}</td>
                <td className="px-3 py-2 text-right">
                  {u.tenantId ? (
                    <Link
                      to="/platform/tenants/$tenantId"
                      params={{ tenantId: u.tenantId }}
                      className="text-[var(--soko-color-primary)]"
                    >
                      Business
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformDevicesPage() {
  const token = useToken();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      lastSeenAt: string | null;
      tenant: { name: string; slug: string; status: string };
      branch: { name: string; code: string } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiRequest<typeof rows>(
      `/platform/devices${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      { token },
    )
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PlatformShell
      title="Devices"
      description="POS terminals and registered devices across businesses. Disablement remains a tenant-scoped admin action unless elevated and audited."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={() => load()}>
          Search
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Device</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Branch</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2">
                  {d.tenant.name}{" "}
                  <span className="text-[var(--soko-color-text-muted)]">({d.tenant.slug})</span>
                </td>
                <td className="px-3 py-2">{d.branch ? `${d.branch.name} (${d.branch.code})` : "—"}</td>
                <td className="px-3 py-2">{d.status}</td>
                <td className="px-3 py-2 text-xs text-[var(--soko-color-text-muted)]">
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformAuditPage() {
  const token = useToken();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      createdAt: string;
      tenant: { slug: string; name: string } | null;
      actor: { email: string; name: string } | null;
      metadata: unknown;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiRequest<typeof rows>(
      `/platform/audit${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      { token },
    )
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PlatformShell
      title="Audit & security"
      description="Operational and platform audit trail. Secrets and tokens are never stored in these rows."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input label="Filter action / entity" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" onClick={() => load()}>
          Filter
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 text-xs">{r.actor?.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.tenant?.slug ?? "platform"}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.entityType}
                  {r.entityId ? `:${r.entityId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}

export function PlatformEntitlementsPage() {
  const token = useToken();
  const [rows, setRows] = useState<
    Array<{
      tenantId: string;
      tenantName?: string;
      tenantSlug?: string;
      tenantStatus?: string;
      subscriptionStatus: string;
      planCode: string;
      planName: string;
      planModules: unknown;
      tenantModules: unknown;
      periodEnd: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<typeof rows>("/platform/entitlements", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <PlatformShell
      title="Module entitlements"
      description="Plan modules vs tenant-enabled packs. Backend EntitlementsService enforces write access — this view is for operators."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[var(--soko-color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--soko-color-surface-muted)] text-xs uppercase text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Sub status</th>
              <th className="px-3 py-2">Plan modules</th>
              <th className="px-3 py-2">Tenant modules</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenantId} className="border-t border-[var(--soko-color-border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{r.tenantName}</p>
                  <p className="text-xs text-[var(--soko-color-text-muted)]">
                    {r.tenantSlug} · {r.tenantStatus}
                  </p>
                </td>
                <td className="px-3 py-2">
                  {r.planName} ({r.planCode})
                </td>
                <td className="px-3 py-2">{r.subscriptionStatus}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {JSON.stringify(r.planModules)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {JSON.stringify(r.tenantModules)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/platform/tenants/$tenantId"
                    params={{ tenantId: r.tenantId }}
                    className="text-[var(--soko-color-primary)]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !error ? (
        <p className="mt-4 text-sm text-[var(--soko-color-text-muted)]">
          No subscriptions yet. Seed plans under Billing, then assign to a tenant.
        </p>
      ) : null}
    </PlatformShell>
  );
}

export function PlatformIntegrationsPage() {
  const token = useToken();
  const [data, setData] = useState<{
    providers: Array<{ key: string; status: string; note: string }>;
    queues: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<NonNullable<typeof data>>("/platform/integrations", { token })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <PlatformShell
      title="Integrations"
      description="Honest provider status. Pending queues are real counts — never invent payment or DNS success."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.queues).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4"
              >
                <p className="text-xs uppercase text-[var(--soko-color-text-muted)]">{k}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-lg font-semibold">Providers</h2>
          <ul className="mt-2 divide-y rounded-lg border border-[var(--soko-color-border)]">
            {data.providers.map((p) => (
              <li key={p.key} className="px-4 py-3 text-sm">
                <p className="font-medium capitalize">
                  {p.key} · <span className="font-mono text-xs">{p.status}</span>
                </p>
                <p className="text-[var(--soko-color-text-muted)]">{p.note}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PlatformShell>
  );
}

export function PlatformSettingsPage() {
  const token = useToken();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [banner, setBanner] = useState("");
  const [bannerOn, setBannerOn] = useState(false);
  const [graceDays, setGraceDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    void apiRequest<{ settings: Record<string, unknown> }>("/platform/settings", { token })
      .then((d) => {
        setSettings(d.settings);
        setBanner(String(d.settings["announcement.banner"] ?? ""));
        setBannerOn(Boolean(d.settings["announcement.enabled"]));
        setGraceDays(String(d.settings["billing.graceDays"] ?? 7));
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiRequest("/platform/settings", {
        method: "POST",
        token,
        body: { key: "announcement.banner", value: banner },
      });
      await apiRequest("/platform/settings", {
        method: "POST",
        token,
        body: { key: "announcement.enabled", value: bannerOn },
      });
      await apiRequest("/platform/settings", {
        method: "POST",
        token,
        body: { key: "billing.graceDays", value: Number(graceDays) || 7 },
      });
      setMsg("Settings saved. Secrets remain in environment / secret manager only.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformShell
      title="Platform settings"
      description="Non-secret operational knobs. API keys, JWT secrets, and SMTP passwords are never editable here."
    >
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {msg ? <p className="mb-3 text-sm text-[var(--soko-color-accent)]">{msg}</p> : null}
      <div className="grid max-w-xl gap-3 rounded-lg border border-[var(--soko-color-border)] p-4">
        <Input
          label="Operator announcement banner"
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bannerOn} onChange={(e) => setBannerOn(e.target.checked)} />
          Show announcement
        </label>
        <Input
          label="Billing grace days"
          value={graceDays}
          onChange={(e) => setGraceDays(e.target.value)}
        />
        <Button disabled={busy} onClick={() => void save()}>
          Save settings
        </Button>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Current map</h2>
      <pre className="mt-2 overflow-auto rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] p-3 text-xs">
        {JSON.stringify(settings, null, 2)}
      </pre>
    </PlatformShell>
  );
}
