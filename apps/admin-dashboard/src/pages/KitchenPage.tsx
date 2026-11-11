import { useEffect, useState } from "react";
import { Button } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type TicketItem = {
  id: string;
  nameSnapshot?: string;
  quantity?: number;
  status?: string;
};

type Ticket = {
  id: string;
  status: string;
  priority?: number;
  station?: string | null;
  createdAt: string;
  items?: TicketItem[];
  sale?: {
    id?: string;
    receiptNumber: string;
    tableCode?: string | null;
    orderType?: string | null;
  };
};

const STATUSES = ["queued", "preparing", "ready", "served", "cancelled"] as const;

export function KitchenPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mode, setMode] = useState<"active" | "served" | "cancelled">("active");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const statusParam =
      mode === "active" ? "queued,preparing,ready" : mode === "served" ? "served" : "cancelled";
    const data = await apiRequest<Ticket[]>(`/kitchen/tickets?status=${encodeURIComponent(statusParam)}`, {
      token,
    });
    setTickets(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
    const t = setInterval(() => {
      void load().catch(() => undefined);
    }, 8000);
    return () => clearInterval(t);
  }, [token, mode]);

  async function setStatus(id: string, status: string) {
    setError(null);
    try {
      await apiRequest(`/kitchen/tickets/${id}`, {
        method: "PATCH",
        token,
        body: { status },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <AppShell title="Kitchen display" description="Live preparation tickets routed from restaurant and bar sales.">
      {error ? <p className="mb-3 text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant={mode === "active" ? "primary" : "secondary"} onClick={() => setMode("active")}>
          Active
        </Button>
        <Button type="button" variant={mode === "served" ? "primary" : "secondary"} onClick={() => setMode("served")}>
          Served
        </Button>
        <Button type="button" variant={mode === "cancelled" ? "primary" : "secondary"} onClick={() => setMode("cancelled")}>
          Cancelled
        </Button>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((t) => (
          <article key={t.id} className="rounded-lg border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.sale?.receiptNumber ?? t.id.slice(0, 8)}</p>
                <p className="text-xs text-[var(--soko-color-text-muted)]">
                  {t.sale?.orderType ?? "order"}
                  {t.sale?.tableCode ? ` · table ${t.sale.tableCode}` : ""}
                  {t.station ? ` · ${t.station}` : ""}
                </p>
              </div>
              <span className="rounded bg-[var(--soko-color-bg)] px-2 py-0.5 text-xs uppercase">{t.status}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {(t.items ?? []).map((line) => (
                <li key={line.id}>
                  {line.quantity ?? 1}× {line.nameSnapshot ?? "Item"}
                  {line.status ? ` (${line.status})` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              {STATUSES.filter((s) => s !== t.status).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded border border-[var(--soko-color-border)] px-2 py-1 text-xs capitalize"
                  onClick={() => void setStatus(t.id, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </article>
        ))}
        {!tickets.length ? (
          <p className="text-sm text-[var(--soko-color-text-muted)]">No kitchen tickets for this filter.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
