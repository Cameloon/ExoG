import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

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
