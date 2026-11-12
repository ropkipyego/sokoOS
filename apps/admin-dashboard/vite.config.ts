import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Admin is the site root on the shared Vercel domain
  base: "/",
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    allowedHosts: true,
  },
});
