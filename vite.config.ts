import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Build-time safety guards: never ship a production bundle with auth bypass
  // or demo-mode shared-login enabled.
  if (mode === "production" && process.env.VITE_ALLOW_AUTH_BYPASS === "1") {
    throw new Error(
      "[security] VITE_ALLOW_AUTH_BYPASS must NOT be set during a production build. Aborting."
    );
  }
  if (mode === "production" && process.env.VITE_DEMO_MODE === "1") {
    throw new Error(
      "[security] VITE_DEMO_MODE must NOT be set during a production build — it shares one clinic across all visitors. Aborting."
    );
  }
  return ({
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
    // PWA with proper cache versioning + update prompts.
    // Hard-disabled in dev so the Lovable preview iframe never sees a SW.
    VitePWA({
      registerType: "prompt",
      injectRegister: null, // we register manually in src/lib/pwa-register.ts
      devOptions: { enabled: false },
      includeAssets: ["placeholder.svg", "robots.txt"],
      manifest: {
        name: "DoctorsBuddy",
        short_name: "DoctorsBuddy",
        description: "Smart Dental Clinic Management",
        start_url: "/dashboard",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#5bb8d4",
        orientation: "portrait-primary",
        icons: [
          { src: "/placeholder.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Don't intercept OAuth / Supabase callbacks
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/storage\/v1/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // user gets to choose when to reload
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html", networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
});
