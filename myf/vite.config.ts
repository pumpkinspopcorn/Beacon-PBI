import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import os from "os";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // Don't rewrite - keep /api prefix so backend routes work correctly
        // Backend expects /api/ask, /api/health, etc.
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.PNG"],
  // Use a cache directory outside OneDrive to avoid file locking issues
  cacheDir: path.join(os.tmpdir(), "vite-cache", path.basename(__dirname)),
}));
