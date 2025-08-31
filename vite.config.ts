import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return ({
  server: {
    host: "127.0.0.1",
    port: 3000,
    hmr: false,
    injectClient: false,
    strictPort: true,
  },
  build: {
    // Generate sourcemaps for Sentry to unminify stack traces
    sourcemap: true,
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      // Only configure Workbox precache for production to avoid dev warnings
      workbox: isDev ? undefined : {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}", "assets/*"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // allow up to 10 MiB (sourcemaps, large chunks)
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: { cacheName: "html-cache" },
          },
          {
            urlPattern: ({ request }) => ["script", "style", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "asset-cache" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "image-cache" },
          },
        ],
      },
      manifest: {
        name: "Prepigo",
        short_name: "Prepigo",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0b0b",
        theme_color: "#0b0b0b",
        icons: [
          { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
          { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
    }),
    // Upload source maps to Sentry during production builds
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "sain-sf",
      project: process.env.SENTRY_PROJECT || "prepigo",
      // Reads SENTRY_AUTH_TOKEN from the environment; do NOT commit tokens
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: {
        assets: ["./dist/**"],
      },
      // Optionally set release; default can be derived by your CI
      release: {
        name: process.env.VITE_RELEASE,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/lib/idb": path.resolve(__dirname, "./src/lib/storage.ts"),
      "src/lib/idb": path.resolve(__dirname, "./src/lib/storage.ts"),
    },
  },
  test: {
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
  });
});
