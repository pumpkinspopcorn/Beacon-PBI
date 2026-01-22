import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      // Windows-specific: Use polling to avoid permission issues
      usePolling: true,
      // Reduce CPU usage from polling
      interval: 1000,
    },
    // Prevent HMR issues on Windows
    strictPort: false,
    // Force clear cache on restart
    force: true,
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
  // Windows-specific optimizations
  optimizeDeps: {
    // Force dependency pre-bundling on every start to avoid cache issues
    force: mode === "development",
    // Exclude problematic dependencies from pre-bundling
    exclude: [],
  },
  // Clear cache directory on Windows to prevent permission issues
  cacheDir: path.resolve(__dirname, "node_modules/.vite-cache"),
  build: {
    // Prevent build cache issues
    emptyOutDir: true,
  },
}));
