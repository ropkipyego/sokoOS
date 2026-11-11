import type { FunctionComponent } from "react";
import { createRootRoute, createRoute, createRouter, redirect, useParams } from "@tanstack/react-router";
import { useAuthStore } from "./stores/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { InventoryPage, MovementsPage } from "./pages/InventoryPage";
import { SalesPage } from "./pages/SalesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ConfigCentrePage } from "./pages/ConfigCentrePage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { KitchenPage } from "./pages/KitchenPage";
import { HotelPage } from "./pages/HotelPage";
import { IndustryPage } from "./pages/IndustryPage";
import { RestaurantFloorPage } from "./pages/RestaurantFloorPage";
import {
  PlatformOverviewPage,
  PlatformTenantsPage,
  PlatformTenantDetailPage,
  PlatformOnboardingPage,
  PlatformHealthPage,
  PlatformDomainsPage,
  PlatformRegistrationsPage,
  PlatformEmailPage,
  PlatformBillingPage,
  PlatformSupportPage,
} from "./pages/platform/PlatformPages";
import {
  PlatformUsersPage,
  PlatformTenantUsersPage,
  PlatformDevicesPage,
  PlatformAuditPage,
  PlatformEntitlementsPage,
  PlatformIntegrationsPage,
  PlatformSettingsPage,
} from "./pages/platform/PlatformConsolePages";
import { ActivatePage } from "./pages/ActivatePage";
import { SupportPage } from "./pages/SupportPage";
import {
  BranchesPage,
  UsersPage,
  CustomersPage,
  SuppliersPage,
  ExpensesPage,
  DeliveriesPage,
  MessagesPage,
  CategoriesPage,
  BrandsPage,
  RolesPage,
  ReturnsPage,
  TransfersPage,
  ReportsPage,
  IntelligencePage,
  IntegrationsPage,
  DevicesPage,
  NotificationsPage,
} from "./pages/ModulesPages";

const rootRoute = createRootRoute();

function requireAuth() {
  if (!useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: "/login" });
  }
}

function r(path: string, component: FunctionComponent) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: requireAuth,
    component,
  });
}

function PlatformTenantDetailRoute() {
  const { tenantId } = useParams({ from: "/platform/tenants/$tenantId" });
  return <PlatformTenantDetailPage tenantId={tenantId} />;
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const activateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activate",
  component: ActivatePage,
});

const platformTenantDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platform/tenants/$tenantId",
  beforeLoad: requireAuth,
  component: PlatformTenantDetailRoute,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  r("/", DashboardPage),
  r("/intelligence", IntelligencePage),
  r("/products", ProductsPage),
  r("/categories", CategoriesPage),
  r("/brands", BrandsPage),
  r("/inventory", InventoryPage),
  r("/movements", MovementsPage),
  r("/transfers", TransfersPage),
  r("/purchases", PurchasesPage),
  r("/sales", SalesPage),
  r("/returns", ReturnsPage),
  r("/deliveries", DeliveriesPage),
  r("/customers", CustomersPage),
  r("/suppliers", SuppliersPage),
  r("/expenses", ExpensesPage),
  r("/config", ConfigCentrePage),
  r("/departments", DepartmentsPage),
  r("/kitchen", KitchenPage),
  r("/restaurant", RestaurantFloorPage),
  r("/hotel", HotelPage),
  r("/industry", IndustryPage),
  r("/branches", BranchesPage),
  r("/users", UsersPage),
  r("/roles", RolesPage),
  r("/messages", MessagesPage),
  r("/reports", ReportsPage),
  r("/settings", SettingsPage),
  r("/integrations", IntegrationsPage),
  r("/devices", DevicesPage),
  r("/notifications", NotificationsPage),
  r("/support", SupportPage),
  r("/platform", PlatformOverviewPage),
  r("/platform/tenants", PlatformTenantsPage),
  platformTenantDetailRoute,
  r("/platform/onboarding", PlatformOnboardingPage),
  r("/platform/registrations", PlatformRegistrationsPage),
  r("/platform/domains", PlatformDomainsPage),
  r("/platform/billing", PlatformBillingPage),
  r("/platform/entitlements", PlatformEntitlementsPage),
  r("/platform/users", PlatformUsersPage),
  r("/platform/tenant-users", PlatformTenantUsersPage),
  r("/platform/devices", PlatformDevicesPage),
  r("/platform/support", PlatformSupportPage),
  r("/platform/email", PlatformEmailPage),
  r("/platform/health", PlatformHealthPage),
  r("/platform/integrations", PlatformIntegrationsPage),
  r("/platform/audit", PlatformAuditPage),
  r("/platform/settings", PlatformSettingsPage),
  activateRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
