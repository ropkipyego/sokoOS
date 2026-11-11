import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input } from "@sokoos/ui";
import { apiRequest } from "../api/client";

export function ActivatePage() {
  const navigate = useNavigate();
  const initialToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/public/invitations/accept", {
        method: "POST",
        body: { token, password, name: name || undefined },
      });
      void navigate({ to: "/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--soko-color-bg)] p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-6">
        <h1 className="text-xl font-semibold">Activate administrator account</h1>
        <p className="text-sm text-[var(--soko-color-text-muted)]">
          Use your one-time invitation token. SokoOS never emails permanent passwords.
        </p>
        {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
        <Input label="Invitation token" value={token} onChange={(e) => setToken(e.target.value)} />
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button disabled={busy || token.length < 16 || password.length < 10} onClick={() => void submit()}>
          {busy ? "Activating…" : "Set password & activate"}
        </Button>
      </div>
    </div>
  );
}
