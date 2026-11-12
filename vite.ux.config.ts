import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import path from "node:path";

// Isolated browser-test server. Production builds never load these aliases.
export default defineConfig((env) => mergeConfig(baseConfig(env), {
  server: { port: 4178 },
  resolve: { alias: [
    { find: "@/hooks/useAuth", replacement: path.resolve("tests/browser/auth.tsx") },
    { find: "@/integrations/external/supabase", replacement: path.resolve("tests/browser/backend.ts") },
    { find: "@clerk/clerk-react", replacement: path.resolve("tests/browser/clerk.ts") },
  ] },
}));
