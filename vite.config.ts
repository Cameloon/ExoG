import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },

  plugins: [tailwindcss(), react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },

    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  build: {
    rollupOptions: {
      output: {
        // Stable, cacheable vendor chunks — otherwise the mixed main chunk
        // (~190 kB gz) re-downloads on every deploy.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom", "react-hook-form"],
          clerk: ["@clerk/clerk-react"],
          supabase: ["@supabase/supabase-js"],
          charts: ["jspdf", "jszip"],
        },
      },
    },
  },
}));
