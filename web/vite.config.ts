import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  // Relative URLs, because Pages serves the site under /aseri/.
  base: "./",
  // `npm run dev` has no API of its own, so it reads the published one.
  server: {
    proxy: {
      "/api": {
        target: "https://exdsgift.github.io/aseri",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../site",
    // The pipeline writes the API into site/api/v1, which a build must not wipe.
    emptyOutDir: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    unstubGlobals: true,
    restoreMocks: true,
    // West of UTC, so a date read in local time lands on the wrong day and fails a test.
    env: { TZ: "America/New_York" },
  },
})
