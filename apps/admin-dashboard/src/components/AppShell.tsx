import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Undo2,
  Truck,
  Package,
  Tags,
  Award,
  Warehouse,
  ArrowLeftRight,
  ClipboardList,
  Users,
  Store,
  UserRound,
  Shield,
  MessageSquare,
  BarChart3,
  Wallet,
  Plug,
  Smartphone,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ScanBarcode,
  Menu,
  X,
  SlidersHorizontal,
  Building,
  Landmark,
  ChefHat,
  BedDouble,
  Factory,
} from "lucide-react";
import { Button } from "@sokoos/ui";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";
import { useEffect, useState } from "react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; perm?: string; external?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, perm: "reports.read" },
      { to: "/intelligence", label: "Business Intelligence", icon: BarChart3, perm: "reports.read" },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        to: import.meta.env.PROD ? "/pos" : "http://POS_HOST:5174",
        label: "POS Terminal",
        icon: ScanBarcode,
        perm: "sales.create",
        external: true,
      },
      { to: "/sales", label: "Sales History", icon: History, perm: "sales.read" },
      { to: "/returns", label: "Credit notes", icon: Undo2, perm: "returns.read" },
      { to: "/deliveries", label: "Deliveries", icon: Truck, perm: "deliveries.read" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { to: "/products", label: "Products", icon: Package, perm: "products.read" },
      { to: "/categories", label: "Categories", icon: Tags, perm: "categories.read" },
      { to: "/brands", label: "Brands", icon: Award, perm: "categories.read" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/inventory", label: "Stock Overview", icon: Warehouse, perm: "inventory.read" },
      { to: "/movements", label: "Stock Movements", icon: ClipboardList, perm: "inventory.read" },
      { to: "/transfers", label: "Transfers", icon: ArrowLeftRight, perm: "inventory.transfer" },
      { to: "/purchases", label: "LPOs / Receiving", icon: ShoppingCart, perm: "purchases.read" },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/customers", label: "Customers", icon: Users, perm: "customers.read" },
      { to: "/suppliers", label: "Suppliers", icon: Store, perm: "suppliers.read" },
      { to: "/expenses", label: "Expenses", icon: Wallet, perm: "expenses.read" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/restaurant", label: "Restaurant floor", icon: ChefHat, perm: "sales.read" },
      { to: "/kitchen", label: "Kitchen", icon: ChefHat, perm: "sales.read" },
      { to: "/hotel", label: "Hotel", icon: BedDouble, perm: "sales.read" },
      { to: "/industry", label: "Industry packs", icon: Factory, perm: "products.read" },
    ],
  },
  {
    title: "Organization",
    items: [
      { to: "/config", label: "Configuration Centre", icon: SlidersHorizontal, perm: "tenant.settings.read" },
      { to: "/departments", label: "Departments", icon: Building, perm: "departments.read" },
      { to: "/branches", label: "Branches", icon: Store, perm: "branches.read" },
      { to: "/users", label: "Employees", icon: UserRound, perm: "users.read" },
      { to: "/roles", label: "Roles", icon: Shield, perm: "roles.read" },
      { to: "/messages", label: "Messages", icon: MessageSquare, perm: "messages.read" },
    ],
  },
  {
    title: "Reports",
    items: [{ to: "/reports", label: "Sales Reports", icon: BarChart3, perm: "reports.read" }],
  },
  {
    title: "System",
    items: [
      { to: "/settings", label: "Settings", icon: Settings, perm: "tenant.settings.read" },
      { to: "/integrations", label: "Integrations", icon: Plug, perm: "settings.manage" },
      { to: "/devices", label: "Devices", icon: Smartphone, perm: "devices.read" },
      { to: "/notifications", label: "Notifications", icon: Bell, perm: "notifications.read" },
      { to: "/platform", label: "Platform console", icon: Landmark, perm: "platform.tenants.read" },
    ],
  },
];

type AppShellProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, description, action, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const permissions = useAuthStore((s) => s.permissions);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const can = (perm?: string) => !perm || permissions.includes(perm);
  const sidebarWidth = collapsed ? 76 : 248;

  function NavBody({ compact }: { compact?: boolean }) {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-5">
          {!compact ? (
            <div>
              <p className="font-display text-2xl tracking-tight text-[var(--soko-color-primary)]">SokoOS</p>
              <p className="text-xs text-[var(--soko-color-text-muted)]">{tenant?.name ?? "Admin"}</p>
            </div>
          ) : (
            <p className="font-display text-xl text-[var(--soko-color-primary)]">S</p>
          )}
          <button
            type="button"
            className="hidden rounded-md p-1 text-[var(--soko-color-text-muted)] lg:inline-flex"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            className="inline-flex rounded-md p-1 text-[var(--soko-color-text-muted)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto px-2 pb-6">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => can(item.perm));
            if (!items.length) return null;
            return (
              <div key={group.title} className="mb-3">
                {!compact ? (
                  <p className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-[var(--soko-color-text-muted)] uppercase">
                    {group.title}
                  </p>
                ) : null}
                {items.map((item) => {
                  const href = item.external
                    ? item.to.replace("POS_HOST", typeof window === "undefined" ? "localhost" : window.location.hostname)
                    : item.to;
                  const active = !item.external && pathname === item.to;
                  const Icon = item.icon;
                  const className = `flex items-center gap-2 rounded-[var(--soko-radius-md)] px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                      : "text-[var(--soko-color-text-muted)] hover:bg-[var(--soko-color-surface-muted)] hover:text-[var(--soko-color-text)]"
                  }`;
                  if (item.external) {
                    return (
                      <a key={item.label} href={href} title={item.label} className={className} target="_blank" rel="noreferrer">
                        <Icon size={16} className="shrink-0" />
                        {!compact ? item.label : null}
                      </a>
                    );
                  }
                  return (
                    <Link key={item.to} to={item.to} title={item.label} className={className}>
                      <Icon size={16} className="shrink-0" />
                      {!compact ? item.label : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className="soko-ui min-h-screen bg-[var(--soko-color-bg)]">
      {/* Desktop / tablet: permanent left sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden overflow-y-auto border-r border-[var(--soko-color-border)] bg-[var(--soko-color-surface)] md:flex md:flex-col"
        style={{ width: sidebarWidth }}
      >
        <NavBody compact={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close overlay" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[248px] flex-col overflow-y-auto bg-[var(--soko-color-surface)] shadow-xl">
            <NavBody />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col" style={{ marginLeft: undefined }}>
        <div className="md:hidden" />
        <div className="flex min-h-screen min-w-0 flex-col md:pl-[var(--soko-sidebar)]" style={{ ["--soko-sidebar" as string]: `${sidebarWidth}px` }}>
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]/90 px-4 py-3 backdrop-blur md:px-5">
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="inline-flex rounded-md border border-[var(--soko-color-border)] p-2 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  online
                    ? "bg-[var(--soko-color-primary-muted)] text-[var(--soko-color-primary)]"
                    : "bg-[var(--soko-color-warning)]/15 text-[var(--soko-color-warning)]"
                }`}
              >
                {online ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="hidden text-[var(--soko-color-text-muted)] sm:inline">{tenant?.name}</span>
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

          <main className="page-fade flex-1 px-4 py-6 md:px-8">
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
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--soko-radius-lg)] border border-dashed border-[var(--soko-color-border)] p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--soko-color-text-muted)]">{body}</p>
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  className = "h-12 w-12",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md bg-[var(--soko-color-surface-muted)] ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[var(--soko-color-text-muted)]">
          No img
        </div>
      )}
    </div>
  );
}
