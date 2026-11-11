import { create } from "zustand";
import { apiRequest } from "../api/client";

const REFRESH_KEY = "sokoos.admin.refreshToken";
const ACCESS_KEY = "sokoos.admin.accessToken";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: string;
};

export type AuthTenant = {
  id: string;
  name: string;
  currency?: string;
  timezone?: string;
  locale?: string;
} | null;

type LoginPayload = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant: AuthTenant;
  permissions: string[];
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  tenant: AuthTenant;
  permissions: string[];
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
  hydrateFromStorage: () => void;
  has: (key: string) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  tenant: null,
  permissions: [],
  isAuthenticated: false,

  has: (key) => get().permissions.includes(key),

  hydrateFromStorage: () => {
    const accessToken = sessionStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!accessToken || !refreshToken) return;
    const rawUser = sessionStorage.getItem("sokoos.admin.user");
    const rawTenant = sessionStorage.getItem("sokoos.admin.tenant");
    const rawPerms = sessionStorage.getItem("sokoos.admin.permissions");
    set({
      accessToken,
      user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
      tenant: rawTenant ? (JSON.parse(rawTenant) as AuthTenant) : null,
      permissions: rawPerms ? (JSON.parse(rawPerms) as string[]) : [],
      isAuthenticated: true,
    });
  },

  login: async (email, password, tenantSlug = "demo") => {
    const body: Record<string, string> = { email, password };
    if (tenantSlug.trim()) body.tenantSlug = tenantSlug.trim();
    const data = await apiRequest<LoginPayload>("/auth/login", {
      method: "POST",
      body,
    });
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    sessionStorage.setItem(ACCESS_KEY, data.accessToken);
    sessionStorage.setItem("sokoos.admin.user", JSON.stringify(data.user));
    sessionStorage.setItem("sokoos.admin.tenant", JSON.stringify(data.tenant));
    sessionStorage.setItem("sokoos.admin.permissions", JSON.stringify(data.permissions ?? []));
    set({
      accessToken: data.accessToken,
      user: data.user,
      tenant: data.tenant,
      permissions: data.permissions ?? [],
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem("sokoos.admin.user");
    sessionStorage.removeItem("sokoos.admin.tenant");
    sessionStorage.removeItem("sokoos.admin.permissions");
    set({ accessToken: null, user: null, tenant: null, permissions: [], isAuthenticated: false });
  },
}));
