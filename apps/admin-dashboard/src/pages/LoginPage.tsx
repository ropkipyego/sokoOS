import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input } from "@sokoos/ui";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [email, setEmail] = useState("demo@sokoos.local");
  const [password, setPassword] = useState("Demo123!");
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password, tenantSlug);
      const platform = useAuthStore.getState().has("platform.tenants.manage")
        || useAuthStore.getState().has("platform.tenants.read");
      if (platform && !tenantSlug.trim()) {
        await navigate({ to: "/platform" as never });
      } else {
        await navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="soko-ui relative flex min-h-screen items-center justify-center px-4 py-10">
      <button
        type="button"
        className="btn-press absolute top-4 right-4 rounded-[var(--soko-radius-md)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] px-3 py-2 text-sm font-semibold"
        onClick={toggleTheme}
      >
        {theme === "light" ? "Dark" : "Light"}
      </button>

      <div className="page-fade w-full max-w-md">
        <p className="font-display text-center text-5xl tracking-tight text-[var(--soko-color-primary)]">SokoOS</p>
        <p className="mt-2 text-center text-[var(--soko-color-text-muted)]">
          Africa&apos;s offline-first commerce platform
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-6"
        >
          <h1 className="text-xl font-semibold">Sign in</h1>
          <Input
            label="Tenant slug (blank for platform console)"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
          />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-[var(--soko-color-danger)]">{error}</p> : null}
          <Button type="submit" className="btn-press w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-[var(--soko-color-text-muted)]">
            Platform: leave tenant blank · platform@sokoos.local / Platform123!
          </p>
        </form>
      </div>
    </div>
  );
}
