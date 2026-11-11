import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Input } from "@sokoos/ui";
import { BUSINESS_TYPES, MODULE_KEYS, type BusinessType } from "@sokoos/types";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

export function ConfigCentrePage() {
  const token = useAuthStore((s) => s.accessToken);
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [types, setTypes] = useState<BusinessType[]>(["retail"]);
  const [modules, setModules] = useState<Record<string, boolean>>({ retail: true });
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<Record<string, unknown>>("/tenant", { token })
      .then((t) => {
        setTenant(t);
        setName(String(t.name ?? ""));
        setTypes((t.businessTypes as BusinessType[]) ?? ["retail"]);
        setModules((t.modulesEnabled as Record<string, boolean>) ?? { retail: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function save() {
    setError(null);
    try {
      const updated = await apiRequest<Record<string, unknown>>("/tenant", {
        method: "PATCH",
        token,
        body: {
          name,
          businessTypes: types,
          modulesEnabled: modules,
          settings: {
            businessMode: modules.hotel || modules.restaurant ? "hybrid" : "retail",
            restaurantEnabled: Boolean(modules.restaurant),
          },
        },
      });
      setTenant(updated);
      setMsg("Configuration saved. Historical sales are unchanged.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <AppShell
      title="Configuration Centre"
      description="Business profile, modules, and links to organization settings. More specific layers (branch / department / terminal) override where permitted."
    >
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      {msg ? <p className="text-sm text-[var(--soko-color-accent)]">{msg}</p> : null}

      <section className="mt-4 max-w-2xl space-y-4 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
        <h2 className="font-semibold">Business identity</h2>
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-[var(--soko-color-text-muted)]">Slug: {String(tenant?.slug ?? "—")} · Currency {String(tenant?.currency ?? "—")}</p>
      </section>

      <section className="mt-4 max-w-2xl space-y-3 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
        <h2 className="font-semibold">Industry profiles</h2>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                  on ? "border-[var(--soko-color-primary)] bg-[var(--soko-color-primary-muted)]" : "border-[var(--soko-color-border)]"
                }`}
                onClick={() => {
                  const set = new Set(types);
                  if (set.has(t)) set.delete(t);
                  else set.add(t);
                  setTypes((set.size ? [...set] : ["retail"]) as BusinessType[]);
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 max-w-2xl space-y-3 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
        <h2 className="font-semibold">Enabled modules</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                checked={Boolean(modules[key])}
                onChange={(e) => setModules({ ...modules, [key]: e.target.checked })}
              />
              {key.replace("_", " ")}
            </label>
          ))}
        </div>
        <Button onClick={() => void save()}>Save profile</Button>
      </section>

      <BrandingPanel token={token} />
      <EffectiveConfigPanel token={token} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: "/departments", label: "Departments" },
          { to: "/branches", label: "Branches" },
          { to: "/users", label: "Employees" },
          { to: "/devices", label: "Terminals" },
          { to: "/products", label: "Products" },
          { to: "/settings", label: "Receipts & integrations" },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4 text-sm font-semibold hover:border-[var(--soko-color-primary)]"
          >
            {card.label}
          </Link>
        ))}
      </section>
    </AppShell>
  );
}

function BrandingPanel({ token }: { token: string | null }) {
  const [primary, setPrimary] = useState("#0F766E");
  const [secondary, setSecondary] = useState("#134E4A");
  const [accent, setAccent] = useState("#F59E0B");
  const [logoUrl, setLogoUrl] = useState("");
  const [loginHeadline, setLoginHeadline] = useState("Welcome");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping with us");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ effective: Record<string, { value: unknown }> }>("/config/effective", { token })
      .then((data) => {
        const e = data.effective ?? {};
        if (typeof e["branding.primaryColor"]?.value === "string") setPrimary(e["branding.primaryColor"].value);
        if (typeof e["branding.secondaryColor"]?.value === "string") setSecondary(e["branding.secondaryColor"].value);
        if (typeof e["branding.accentColor"]?.value === "string") setAccent(e["branding.accentColor"].value);
        if (typeof e["branding.logoUrl"]?.value === "string") setLogoUrl(e["branding.logoUrl"].value);
        if (typeof e["branding.loginHeadline"]?.value === "string") setLoginHeadline(e["branding.loginHeadline"].value);
        if (typeof e["branding.receiptFooter"]?.value === "string") setReceiptFooter(e["branding.receiptFooter"].value);
      })
      .catch((e: Error) => setErr(e.message));
  }, [token]);

  async function save() {
    setErr(null);
    setMsg(null);
    const pairs: Array<[string, unknown]> = [
      ["branding.primaryColor", primary],
      ["branding.secondaryColor", secondary],
      ["branding.accentColor", accent],
      ["branding.logoUrl", logoUrl || null],
      ["branding.loginHeadline", loginHeadline],
      ["branding.receiptFooter", receiptFooter],
    ];
    try {
      for (const [key, value] of pairs) {
        await apiRequest("/config/overrides", {
          method: "POST",
          token,
          body: { layer: "tenant", key, value },
        });
      }
      setMsg("Branding saved. Existing receipts/reports keep historical values.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <section className="mt-6 max-w-2xl space-y-3 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
      <h2 className="font-semibold">Branding</h2>
      <p className="text-xs text-[var(--soko-color-text-muted)]">
        Tenant colors, logo URL, login and receipt identity. Typed keys only — not free-form JSON.
      </p>
      {err ? <p className="text-sm text-[var(--soko-color-danger)]">{err}</p> : null}
      {msg ? <p className="text-sm text-[var(--soko-color-accent)]">{msg}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Primary" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        <Input label="Secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
        <Input label="Accent" value={accent} onChange={(e) => setAccent(e.target.value)} />
      </div>
      <Input label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
      <Input label="Login headline" value={loginHeadline} onChange={(e) => setLoginHeadline(e.target.value)} />
      <Input label="Receipt footer" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
      <Button onClick={() => void save()}>Save branding</Button>
    </section>
  );
}

function EffectiveConfigPanel({ token }: { token: string | null }) {
  const [rows, setRows] = useState<Array<{ key: string; value: unknown; source: string }>>([]);
  const [overrideKey, setOverrideKey] = useState("receiptFooter");
  const [overrideValue, setOverrideValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<{
      effective: Record<string, { value: unknown; source: string }>;
    }>("/config/effective", { token });
    const effective = data.effective ?? {};
    setRows(
      Object.entries(effective)
        .map(([key, v]) => ({ key, value: v.value, source: v.source }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    );
  }

  useEffect(() => {
    void load().catch((e: Error) => setErr(e.message));
  }, [token]);

  async function saveOverride() {
    setErr(null);
    let value: unknown = overrideValue;
    try {
      value = JSON.parse(overrideValue);
    } catch {
      /* plain string */
    }
    await apiRequest("/config/overrides", {
      method: "POST",
      token,
      body: { layer: "tenant", key: overrideKey, value },
    });
    await load();
  }

  return (
    <section className="mt-6 max-w-3xl space-y-3 rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
      <h2 className="font-semibold">Effective configuration</h2>
      <p className="text-xs text-[var(--soko-color-text-muted)]">
        Platform → Tenant → Branch → Department → Terminal. Overrides never rewrite historical sales.
      </p>
      {err ? <p className="text-sm text-[var(--soko-color-danger)]">{err}</p> : null}
      <div className="max-h-64 overflow-auto text-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-[var(--soko-color-text-muted)]">
              <th className="py-1">Key</th>
              <th>Value</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--soko-color-border)]">
                <td className="py-1 font-mono text-xs">{r.key}</td>
                <td className="font-mono text-xs">{typeof r.value === "string" ? r.value : JSON.stringify(r.value)}</td>
                <td className="capitalize">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input label="Key" value={overrideKey} onChange={(e) => setOverrideKey(e.target.value)} />
        <Input label="Value" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} />
        <div className="flex items-end">
          <Button type="button" onClick={() => void saveOverride()}>
            Set tenant override
          </Button>
        </div>
      </div>
    </section>
  );
}
