import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Local Electron/dev keeps relative assets; Vercel services mount POS under /pos
  base: process.env.VERCEL ? "/pos/" : "./",
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    allowedHosts: true,
  },
});
