import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Application installable : l'interface reste disponible sans réseau.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "FasoLib",
        short_name: "FasoLib",
        description: "Des livres techniques en data, cybersécurité et backend, à lire même hors ligne.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#0b1b3a",
        theme_color: "#0b1b3a",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Interface mise en cache à l'installation (le lecteur PDF compris).
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,webp,jpg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Toute adresse du site ouvre l'application, même hors ligne ; l'API reste au serveur.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/geniuspay\//],
        runtimeCaching: [
          {
            // Images du site, gardées pour s'afficher sans réseau — les couvertures
            // comprises, puisque Nginx les sert sous /media/, donc sur notre origine.
            //
            // La condition `sameOrigin` reste nécessaire : une image venue d'ailleurs,
            // reprise par le service worker, serait redemandée sans l'autorisation
            // d'origine voulue, et ne s'afficherait plus du tout.
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 300, maxAgeSeconds: THIRTY_DAYS },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Catalogue public : réseau d'abord, dernière version connue sans réseau.
            // Seules la liste et la fiche d'un livre sont gardées ; les sous-routes
            // (note du client, téléchargement) ne doivent jamais être mises en cache.
            urlPattern: ({ url }) => /^\/api\/(books|categories)\/([^/]+\/)?$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "catalogue",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: THIRTY_DAYS },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": "/src" } },
  server: {
    // Comme Nginx en production : le navigateur ne parle qu'à une seule origine,
    // et les appels /api sont transmis à Django.
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
