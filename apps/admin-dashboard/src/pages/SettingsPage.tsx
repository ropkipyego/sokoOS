import { Button, Input } from "@sokoos/ui";
import { AppShell } from "../components/AppShell";
import { API_URL } from "../api/client";
import { useThemeStore } from "../stores/theme";

export function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <AppShell title="Settings" description="Tenant preferences for this admin workspace.">
      <div className="max-w-xl space-y-6 rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] p-5">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="mb-3 text-sm text-[var(--soko-color-text-muted)]">Light or dark — stored on this device.</p>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "primary" : "secondary"}
              className="btn-press"
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "primary" : "secondary"}
              className="btn-press"
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">API</h2>
          <p className="mb-3 text-sm text-[var(--soko-color-text-muted)]">
            Requests use <code className="text-[var(--soko-color-primary)]">VITE_API_URL</code>.
          </p>
          <Input label="Current API base" value={API_URL} readOnly />
        </div>
      </div>
    </AppShell>
  );
}
