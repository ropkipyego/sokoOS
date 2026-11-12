import { create } from "zustand";
import { apiRequest } from "../api/client";

export type BusinessMode = "retail" | "restaurant" | "hybrid";

type Session = {
  accessToken: string | null;
  cashierName: string;
  cashierId: string | null;
  branchId: string | null;
  branchName: string;
  warehouseId: string | null;
  departmentId: string | null;
  departmentName: string;
  currency: string;
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  deviceId: string | null;
  businessMode: BusinessMode;
  restaurantEnabled: boolean;
  hotelEnabled: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
  setDepartment: (id: string | null, name?: string) => void;
};

async function ensurePosDevice(
  token: string,
  branchId: string | null,
): Promise<string> {
  let deviceId = sessionStorage.getItem("sokoos.pos.deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    sessionStorage.setItem("sokoos.pos.deviceId", deviceId);
  }
  if (!branchId) return deviceId;
  try {
    await apiRequest("/auth/devices/register", {
      method: "POST",
      token,
      body: {
        name: `POS ${typeof navigator !== "undefined" ? navigator.platform : "device"}`,
        branchId,
        deviceId,
      },
    });
  } catch {
    // May lack devices.write — fall back to an already-registered device
    try {
      const listed = await apiRequest<
        Array<{ id: string; status: string }> | { data: Array<{ id: string; status: string }> }
      >("/auth/devices", { token });
      const rows = Array.isArray(listed) ? listed : listed.data;
      const active = rows.find((d) => d.id === deviceId) ?? rows.find((d) => d.status === "active");
      if (active) {
        deviceId = active.id;
        sessionStorage.setItem("sokoos.pos.deviceId", deviceId);
      }
    } catch {
      /* sync will surface DEVICE errors until registered */
    }
  }
  return deviceId;
}

function readMode(raw: string | null): BusinessMode {
  if (raw === "restaurant" || raw === "hybrid" || raw === "retail") return raw;
  return "retail";
}

export const useSession = create<Session>((set) => ({
  accessToken: sessionStorage.getItem("sokoos.pos.token"),
  cashierName: sessionStorage.getItem("sokoos.pos.cashier") ?? "Cashier",
  cashierId: sessionStorage.getItem("sokoos.pos.cashierId"),
  branchId: sessionStorage.getItem("sokoos.pos.branchId"),
  branchName: sessionStorage.getItem("sokoos.pos.branchName") ?? "Branch",
  warehouseId: sessionStorage.getItem("sokoos.pos.warehouseId"),
  departmentId: sessionStorage.getItem("sokoos.pos.departmentId"),
  departmentName: sessionStorage.getItem("sokoos.pos.departmentName") ?? "",
  currency: sessionStorage.getItem("sokoos.pos.currency") ?? "KES",
  tenantId: sessionStorage.getItem("sokoos.pos.tenantId"),
  tenantSlug: sessionStorage.getItem("sokoos.pos.tenantSlug") ?? "demo",
  tenantName: sessionStorage.getItem("sokoos.pos.tenantName") ?? "SokoOS",
  deviceId: sessionStorage.getItem("sokoos.pos.deviceId"),
  businessMode: readMode(sessionStorage.getItem("sokoos.pos.businessMode")),
  restaurantEnabled: sessionStorage.getItem("sokoos.pos.restaurantEnabled") === "1",
  hotelEnabled: sessionStorage.getItem("sokoos.pos.hotelEnabled") === "1",

  hydrate: () => {
    set({
      accessToken: sessionStorage.getItem("sokoos.pos.token"),
      cashierName: sessionStorage.getItem("sokoos.pos.cashier") ?? "Cashier",
      cashierId: sessionStorage.getItem("sokoos.pos.cashierId"),
      branchId: sessionStorage.getItem("sokoos.pos.branchId"),
      branchName: sessionStorage.getItem("sokoos.pos.branchName") ?? "Branch",
      warehouseId: sessionStorage.getItem("sokoos.pos.warehouseId"),
      departmentId: sessionStorage.getItem("sokoos.pos.departmentId"),
      departmentName: sessionStorage.getItem("sokoos.pos.departmentName") ?? "",
      currency: sessionStorage.getItem("sokoos.pos.currency") ?? "KES",
      tenantId: sessionStorage.getItem("sokoos.pos.tenantId"),
      tenantSlug: sessionStorage.getItem("sokoos.pos.tenantSlug") ?? "demo",
      tenantName: sessionStorage.getItem("sokoos.pos.tenantName") ?? "SokoOS",
      deviceId: sessionStorage.getItem("sokoos.pos.deviceId"),
      businessMode: readMode(sessionStorage.getItem("sokoos.pos.businessMode")),
      restaurantEnabled: sessionStorage.getItem("sokoos.pos.restaurantEnabled") === "1",
      hotelEnabled: sessionStorage.getItem("sokoos.pos.hotelEnabled") === "1",
    });
  },

  setDepartment: (id, name) => {
    if (id) sessionStorage.setItem("sokoos.pos.departmentId", id);
    else sessionStorage.removeItem("sokoos.pos.departmentId");
    if (name) sessionStorage.setItem("sokoos.pos.departmentName", name);
    else sessionStorage.removeItem("sokoos.pos.departmentName");
    set({ departmentId: id, departmentName: name ?? "" });
  },

  login: async (email, password, tenantSlug) => {
    const data = await apiRequest<{
      accessToken: string;
      user: { id: string; name: string };
      tenant: { id?: string; currency: string; name?: string; slug?: string } | null;
    }>("/auth/login", { method: "POST", body: { email, password, tenantSlug } });
    const me = await apiRequest<{
      roles: Array<{ branchId: string | null }>;
      tenant: {
        id?: string;
        currency?: string;
        name?: string;
        slug?: string;
        modulesEnabled?: Record<string, boolean>;
        settings?: { businessMode?: string; restaurantEnabled?: boolean };
      } | null;
    }>("/auth/me", { token: data.accessToken });
    const branches = await apiRequest<Array<{ id: string; name: string }> | { data: Array<{ id: string; name: string }> }>(
      "/branches",
      { token: data.accessToken },
    );
    const branchList = Array.isArray(branches) ? branches : branches.data;
    const roleBranch = me.roles.find((r) => r.branchId)?.branchId;
    const branch = branchList.find((b) => b.id === roleBranch) ?? branchList[0];
    const warehouses = branch
      ? await apiRequest<Array<{ id: string; isDefault?: boolean }> | { data: Array<{ id: string; isDefault?: boolean }> }>(
          `/warehouses?branchId=${branch.id}`,
          { token: data.accessToken },
        )
      : [];
    const whList = Array.isArray(warehouses) ? warehouses : warehouses.data;
    const warehouse = whList.find((w) => w.isDefault) ?? whList[0];

    let departmentId: string | null = null;
    let departmentName = "";
    try {
      const deps = await apiRequest<
        Array<{ id: string; name: string; branchId?: string | null }> | { data: Array<{ id: string; name: string; branchId?: string | null }> }
      >("/departments", { token: data.accessToken });
      const list = Array.isArray(deps) ? deps : deps.data;
      const preferred = list.find((d) => d.branchId === branch?.id) ?? list[0];
      if (preferred) {
        departmentId = preferred.id;
        departmentName = preferred.name;
      }
    } catch {
      /* departments optional for older tenants */
    }

    const settings = me.tenant?.settings ?? {};
    const modules = me.tenant?.modulesEnabled ?? {};
    const businessMode = readMode(settings.businessMode ?? null);
    const restaurantEnabled =
      Boolean(settings.restaurantEnabled) || Boolean(modules.restaurant) || businessMode !== "retail";
    const hotelEnabled = Boolean(modules.hotel);
    const tenantName = me.tenant?.name ?? data.tenant?.name ?? "SokoOS";
    const slug = me.tenant?.slug ?? tenantSlug;
    const tenantId = me.tenant?.id ?? data.tenant?.id ?? null;
    const deviceId = await ensurePosDevice(data.accessToken, branch?.id ?? null);

    sessionStorage.setItem("sokoos.pos.token", data.accessToken);
    sessionStorage.setItem("sokoos.pos.cashier", data.user.name);
    sessionStorage.setItem("sokoos.pos.cashierId", data.user.id);
    if (tenantId) sessionStorage.setItem("sokoos.pos.tenantId", tenantId);
    sessionStorage.setItem("sokoos.pos.tenantSlug", slug);
    sessionStorage.setItem("sokoos.pos.tenantName", tenantName);
    sessionStorage.setItem("sokoos.pos.deviceId", deviceId);
    sessionStorage.setItem("sokoos.pos.businessMode", businessMode);
    sessionStorage.setItem("sokoos.pos.restaurantEnabled", restaurantEnabled ? "1" : "0");
    sessionStorage.setItem("sokoos.pos.hotelEnabled", hotelEnabled ? "1" : "0");
    if (branch) {
      sessionStorage.setItem("sokoos.pos.branchId", branch.id);
      sessionStorage.setItem("sokoos.pos.branchName", branch.name);
    }
    if (warehouse) sessionStorage.setItem("sokoos.pos.warehouseId", warehouse.id);
    if (departmentId) {
      sessionStorage.setItem("sokoos.pos.departmentId", departmentId);
      sessionStorage.setItem("sokoos.pos.departmentName", departmentName);
    }
    sessionStorage.setItem("sokoos.pos.currency", data.tenant?.currency ?? me.tenant?.currency ?? "KES");
    set({
      accessToken: data.accessToken,
      cashierName: data.user.name,
      cashierId: data.user.id,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? "Branch",
      warehouseId: warehouse?.id ?? null,
      departmentId,
      departmentName,
      currency: data.tenant?.currency ?? me.tenant?.currency ?? "KES",
      tenantId,
      tenantSlug: slug,
      tenantName,
      deviceId,
      businessMode,
      restaurantEnabled,
      hotelEnabled,
    });
  },

  logout: () => {
    const keys = [
      "sokoos.pos.token",
      "sokoos.pos.cashier",
      "sokoos.pos.cashierId",
      "sokoos.pos.branchId",
      "sokoos.pos.branchName",
      "sokoos.pos.warehouseId",
      "sokoos.pos.departmentId",
      "sokoos.pos.departmentName",
      "sokoos.pos.currency",
      "sokoos.pos.tenantId",
      "sokoos.pos.tenantSlug",
      "sokoos.pos.tenantName",
      "sokoos.pos.businessMode",
      "sokoos.pos.restaurantEnabled",
      "sokoos.pos.hotelEnabled",
      // Keep deviceId across logout so re-login reuses the registered device
    ];
    for (const k of keys) sessionStorage.removeItem(k);
    set({
      accessToken: null,
      cashierName: "Cashier",
      cashierId: null,
      branchId: null,
      branchName: "Branch",
      warehouseId: null,
      departmentId: null,
      departmentName: "",
      currency: "KES",
      tenantId: null,
      tenantSlug: "demo",
      tenantName: "SokoOS",
      deviceId: sessionStorage.getItem("sokoos.pos.deviceId"),
      businessMode: "retail",
      restaurantEnabled: false,
      hotelEnabled: false,
    });
  },
}));
