import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

type Tenant = {
  name: string;
  currency: string;
  timezone: string;
  locale: string;
  settings: Record<string, unknown>;
};

export function SettingsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<Tenant>("/tenant", { token }).then(setTenant);
  }, [token]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!tenant) return;
    await apiRequest("/tenant", {
      method: "PATCH",
      token,
      body: {
        name: tenant.name,
        currency: tenant.currency,
        timezone: tenant.timezone,
        locale: tenant.locale,
        settings: tenant.settings,
      },
    });
    setMsg("Saved");
  }

  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const receipts = (settings.receipts ?? {}) as Record<string, string>;
  const pos = (settings.pos ?? {}) as Record<string, string>;
  const mpesa = (settings.mpesa ?? {}) as Record<string, string>;
  const etims = (settings.etims ?? {}) as Record<string, string>;
  const company = (settings.company ?? {}) as Record<string, string>;
  const lpo = (settings.lpo ?? {}) as Record<string, string>;

  function patchSettings(key: string, value: unknown) {
    if (!tenant) return;
    setTenant({ ...tenant, settings: { ...settings, [key]: value } });
  }

  return (
    <AppShell title="Settings" description="Business, POS, receipts, M-Pesa, and KRA eTIMS configuration. Secrets stay on the server.">
      {!tenant ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-8">
          <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <h2 className="font-display text-xl">Business</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="Name" value={tenant.name} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
              <Input label="Currency" value={tenant.currency} onChange={(e) => setTenant({ ...tenant, currency: e.target.value })} />
              <Input label="Timezone" value={tenant.timezone} onChange={(e) => setTenant({ ...tenant, timezone: e.target.value })} />
              <Input label="Locale" value={tenant.locale} onChange={(e) => setTenant({ ...tenant, locale: e.target.value })} />
              <Input label="Address" value={company.address ?? ""} onChange={(e) => patchSettings("company", { ...company, address: e.target.value })} />
              <Input label="Phone" value={company.phone ?? ""} onChange={(e) => patchSettings("company", { ...company, phone: e.target.value })} />
              <Input label="Email" value={company.email ?? ""} onChange={(e) => patchSettings("company", { ...company, email: e.target.value })} />
              <Input label="Tax ID / PIN" value={company.taxId ?? ""} onChange={(e) => patchSettings("company", { ...company, taxId: e.target.value })} />
              <Input label="Logo URL (optional)" value={company.logoUrl ?? ""} onChange={(e) => patchSettings("company", { ...company, logoUrl: e.target.value })} />
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold">Appearance</p>
              <Button type="button" variant="secondary" className="mt-2" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                Theme: {theme}
              </Button>
            </div>
          </section>

          <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <h2 className="font-display text-xl">LPO document template</h2>
            <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">
              A built-in preview template is used today on Purchases. Upload a custom branded template later — the slot is ready.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                label="Template name"
                value={lpo.templateName ?? "Standard LPO template"}
                onChange={(e) => patchSettings("lpo", { ...lpo, templateName: e.target.value })}
              />
              <Input
                label="Footer / terms"
                value={lpo.footer ?? ""}
                onChange={(e) => patchSettings("lpo", { ...lpo, footer: e.target.value })}
              />
              <label className="text-sm md:col-span-2">
                Custom template file (coming soon)
                <input
                  type="file"
                  accept=".pdf,.docx,.html"
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    patchSettings("lpo", {
                      ...lpo,
                      customTemplateName: file.name,
                      customTemplatePending: "true",
                      customTemplateNote: "Stored as preference — server upload endpoint will accept this file in a follow-up.",
                    });
                    setMsg(`Selected ${file.name}. Save settings to remember the preference; binary upload lands next.`);
                  }}
                />
              </label>
              {lpo.customTemplateName ? (
                <p className="text-sm text-[var(--soko-color-text-muted)] md:col-span-2">
                  Pending template: {lpo.customTemplateName}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <h2 className="font-display text-xl">POS & receipts</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Customer capture
                <select
                  className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2"
                  value={pos.customerMode ?? "optional"}
                  onChange={(e) => patchSettings("pos", { ...pos, customerMode: e.target.value })}
                >
                  <option value="optional">Optional walk-in</option>
                  <option value="required">Required</option>
                </select>
              </label>
              <label className="text-sm">
                Printer profile
                <select
                  className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2"
                  value={receipts.profile ?? "80mm"}
                  onChange={(e) => patchSettings("receipts", { ...receipts, profile: e.target.value })}
                >
                  <option value="58mm">58mm thermal</option>
                  <option value="80mm">80mm thermal (X-80)</option>
                  <option value="a4">A4 invoice</option>
                </select>
              </label>
              <Input
                label="Header text"
                value={receipts.header ?? ""}
                onChange={(e) => patchSettings("receipts", { ...receipts, header: e.target.value })}
              />
              <Input
                label="Footer text"
                value={receipts.footer ?? "Goods once sold are not returnable without receipt"}
                onChange={(e) => patchSettings("receipts", { ...receipts, footer: e.target.value })}
              />
            </div>
            <Button className="mt-3" type="button" variant="secondary" onClick={() => window.print()}>
              Test print (browser / X-80 as default printer)
            </Button>
          </section>

          <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <h2 className="font-display text-xl">M-Pesa (Daraja)</h2>
            <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">
              An STK Push request is not a payment. Status stays pending until the callback is verified.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="Shortcode" value={mpesa.shortcode ?? ""} onChange={(e) => patchSettings("mpesa", { ...mpesa, shortcode: e.target.value })} />
              <Input label="Environment" value={mpesa.env ?? "sandbox"} onChange={(e) => patchSettings("mpesa", { ...mpesa, env: e.target.value })} />
              <Input label="Callback URL" value={mpesa.callbackUrl ?? ""} onChange={(e) => patchSettings("mpesa", { ...mpesa, callbackUrl: e.target.value })} />
              <Input label="Consumer key (stored server-side)" value={mpesa.consumerKey ?? ""} onChange={(e) => patchSettings("mpesa", { ...mpesa, consumerKey: e.target.value })} />
            </div>
          </section>

          <section className="rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <h2 className="font-display text-xl">KRA eTIMS</h2>
            <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">
              Official OSCU/VSCU only. SokoOS receipts are not fiscal invoices until KRA confirms identifiers.
              OSCU prod: https://etims-api.kra.go.ke/etims-api/ · sandbox: https://etims-api-sbx.kra.go.ke/etims-api/
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="KRA PIN" value={etims.pin ?? ""} onChange={(e) => patchSettings("etims", { ...etims, pin: e.target.value })} />
              <Input label="Branch ID" value={etims.branchId ?? ""} onChange={(e) => patchSettings("etims", { ...etims, branchId: e.target.value })} />
              <label className="text-sm">
                Control unit
                <select
                  className="mt-1 w-full rounded-md border border-[var(--soko-color-border)] bg-transparent p-2"
                  value={etims.mode ?? "unconfigured"}
                  onChange={(e) => patchSettings("etims", { ...etims, mode: e.target.value })}
                >
                  <option value="unconfigured">Not configured</option>
                  <option value="oscu">OSCU (always online)</option>
                  <option value="vscu">VSCU (local JAR)</option>
                </select>
              </label>
              <Input label="VSCU URL" value={etims.vscuUrl ?? "http://127.0.0.1:8088"} onChange={(e) => patchSettings("etims", { ...etims, vscuUrl: e.target.value })} />
            </div>
            <p className="mt-2 text-xs text-[var(--soko-color-warning)]">Submission adapter is queued, not live-certified. Do not treat printed receipts as eTIMS invoices.</p>
          </section>

          {msg ? <p className="text-sm text-[var(--soko-color-success)]">{msg}</p> : null}
          <Button type="submit">Save settings</Button>
        </form>
      )}
    </AppShell>
  );
}
