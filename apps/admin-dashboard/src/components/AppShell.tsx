import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@sokoos/ui";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/inventory", label: "Inventory" },
  { to: "/sales", label: "Sales" },
  { to: "/branches", label: "Branches" },
  { to: "/users", label: "Users" },
  { to: "/settings", label: "Settings" },
] as const;

type AppShellProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, description, action, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <div className="soko-ui min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] lg:border-b-0 lg:border-r">
        <div className="px-5 py-6">
          <p className="font-display text-2xl tracking-tight text-[var(--soko-color-primary)]">SokoOS</p>
          <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">Admin</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-[var(--soko-radius-md)] px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                    : "text-[var(--soko-color-text-muted)] hover:bg-[var(--soko-color-surface-muted)] hover:text-[var(--soko-color-text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]/90 px-5 py-3 backdrop-blur">
          <div className="text-sm text-[var(--soko-color-text-muted)]">
            Branch: <span className="font-semibold text-[var(--soko-color-text)]">Nairobi CBD</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="btn-press" onClick={toggleTheme}>
              {theme === "light" ? "Dark" : "Light"}
            </Button>
            <span className="text-sm text-[var(--soko-color-text-muted)]">{user?.name}</span>
            <Button variant="secondary" size="sm" className="btn-press" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="page-fade flex-1 px-5 py-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-[var(--soko-color-text)]">{title}</h1>
              <p className="mt-1 max-w-2xl text-[var(--soko-color-text-muted)]">{description}</p>
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
