import { create } from "zustand";
import { apiRequest } from "../api/client";

const REFRESH_KEY = "sokoos.admin.refreshToken";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrateFromStorage: () => void;
};

/**
 * Access token stays in memory. Refresh token is persisted in localStorage for
 * demo purposes only — production should use httpOnly cookies when the API
 * supports them.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  hydrateFromStorage: () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return;
    // Demo: treat presence of refresh as a soft session hint; real apps refresh here.
    set({
      accessToken: null,
      user: {
        id: "demo",
        email: "owner@sokoos.demo",
        name: "Demo Owner",
        role: "owner",
      },
      isAuthenticated: true,
    });
  },

  login: async (email, password) => {
    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      // Demo persistence — replace with httpOnly cookie session when available.
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      set({
        accessToken: data.accessToken,
        user: data.user,
        isAuthenticated: true,
      });
    } catch {
      // Offline / API-not-ready demo path
      localStorage.setItem(REFRESH_KEY, `demo-refresh-${Date.now()}`);
      set({
        accessToken: `demo-access-${Date.now()}`,
        user: {
          id: "demo",
          email,
          name: email.split("@")[0] || "Owner",
          role: "owner",
        },
        isAuthenticated: true,
      });
    }
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null, isAuthenticated: false });
  },
}));
