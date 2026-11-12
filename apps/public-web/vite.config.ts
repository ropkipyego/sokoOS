import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Local stays at /; Vercel services mount public-web under /register
  base: process.env.VERCEL ? "/register/" : "/",
  server: {
    host: true,
    port: 5176,
    strictPort: true,
  },
});
