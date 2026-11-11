import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Shield,
  Activity,
  LogOut,
  ArrowLeft,
  Globe,
  Mail,
  CreditCard,
  LifeBuoy,
  Users,
  UserCog,
  MonitorSmartphone,
  ScrollText,
  Puzzle,
  Settings,
  Layers,
  ClipboardList,
} from "lucide-react";
import { useAuthStore } from "../stores/auth";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Control",
    items: [
      { to: "/platform", label: "Overview", icon: LayoutDashboard },
      { to: "/platform/tenants", label: "Businesses", icon: Building2 },
      { to: "/platform/onboarding", label: "Onboard client", icon: UserPlus },
      { to: "/platform/registrations", label: "Registrations", icon: ClipboardList },
    ],
  },
  {
    label: "Commercial",
    items: [
      { to: "/platform/billing", label: "Plans & billing", icon: CreditCard },
      { to: "/platform/entitlements", label: "Entitlements", icon: Layers },
      { to: "/platform/domains", label: "Domains", icon: Globe },
    ],
  },
  {
    label: "People & devices",
    items: [
      { to: "/platform/users", label: "Platform users", icon: UserCog },
      { to: "/platform/tenant-users", label: "Tenant users", icon: Users },
      { to: "/platform/devices", label: "Devices", icon: MonitorSmartphone },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/platform/support", label: "Support", icon: LifeBuoy },
      { to: "/platform/email", label: "Email", icon: Mail },
      { to: "/platform/health", label: "Monitoring", icon: Activity },
      { to: "/platform/integrations", label: "Integrations", icon: Puzzle },
      { to: "/platform/audit", label: "Audit & security", icon: ScrollText },
      { to: "/platform/settings", label: "Platform settings", icon: Settings },
    ],
  },
];

export function PlatformShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const has = useAuthStore((s) => s.has);
  const isPlatform =
    has("platform.tenants.manage") ||
    has("platform.tenants.read") ||
    has("platform.users.manage") ||
    has("platform.health.read");

  if (!isPlatform) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-3 text-center">
          <Shield className="mx-auto h-10 w-10 text-[var(--soko-color-danger)]" />
          <h1 className="text-xl font-semibold">Platform access required</h1>
          <p className="text-sm text-[var(--soko-color-text-muted)]">
            This console is only for SokoOS platform operators. Tenant users cannot view other businesses.
          </p>
          <Link to="/" className="text-[var(--soko-color-primary)] underline">
            Back to business dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--soko-color-bg)] text-[var(--soko-color-text)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
        <div className="border-b border-[var(--soko-color-border)] px-4 py-4">
          <p className="font-display text-xl text-[var(--soko-color-primary)]">SokoOS Platform</p>
          <p className="text-xs text-[var(--soko-color-text-muted)]">Commercial control centre</p>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--soko-color-text-muted)]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.to ||
                    (item.to !== "/platform" && pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                        active
                          ? "bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                          : "text-[var(--soko-color-text-muted)] hover:bg-[var(--soko-color-surface-muted)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t border-[var(--soko-color-border)] p-3 text-sm">
          <p className="truncate px-2 text-[var(--soko-color-text-muted)]">{user?.email}</p>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[var(--soko-color-surface-muted)]"
          >
            <ArrowLeft className="h-4 w-4" /> Tenant apps
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-[var(--soko-color-surface-muted)]"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-[var(--soko-color-text-muted)]">{description}</p>
          ) : null}
        </header>
        {children}
      </main>
    </div>
  );
}
