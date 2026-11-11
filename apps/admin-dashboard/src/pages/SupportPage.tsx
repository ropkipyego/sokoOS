import { useEffect, useState } from "react";
import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { apiRequest } from "../api/client";
import { useAuthStore } from "../stores/auth";

type Ticket = { id: string; subject: string; status: string; priority: string };

export function SupportPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiRequest<Ticket[]>("/support/tickets", { token })
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async () => {
    try {
      await apiRequest("/support/tickets", { method: "POST", token, body: { subject, body } });
      setSubject("");
      setBody("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AppShell title="Support" description="Submit and track requests. Platform internal notes are never shown here.">
      {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
      <div className="mb-6 grid max-w-xl gap-2">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input label="Details" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button onClick={() => void create()}>Submit request</Button>
      </div>
      <ul className="divide-y rounded-lg border border-[var(--soko-color-border)]">
        {rows.map((t) => (
          <li key={t.id} className="px-4 py-3 text-sm">
            {t.subject} · {t.status} · {t.priority}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
