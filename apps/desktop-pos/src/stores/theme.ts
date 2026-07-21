import { create } from "zustand";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  hydrate: () => void;
};

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  hydrate: () => {
    const stored = localStorage.getItem("sokoos.pos.theme");
    const theme: ThemeMode = stored === "dark" ? "dark" : "light";
    applyTheme(theme);
    set({ theme });
  },
  setTheme: (theme) => {
    localStorage.setItem("sokoos.pos.theme", theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },
}));
