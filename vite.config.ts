import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "127.0.0.1",
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

  // Let Rollup place shared helpers independently of optional auth/export code.
  // The manifest regression check guards the public static dependency graph.
  build: { manifest: true },
}));
