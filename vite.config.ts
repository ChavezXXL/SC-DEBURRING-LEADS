import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // autoUpdate + workbox skipWaiting/clientsClaim below = a new deploy's
        // service worker takes control on the next load without the user having
        // to hard-refresh or clear the SW. This is the fix for the app's history
        // of serving stale builds. main.tsx still surfaces a "refresh" toast so
        // an already-open tab can update in place instead of waiting for a
        // full close/reopen.
        registerType: 'autoUpdate',
        workbox: {
          // Take over immediately so the freshest build is what runs.
          skipWaiting: true,
          clientsClaim: true,
          // Delete precache entries from previous deploys so users never get a
          // half-old/half-new asset set (a classic stale-build cause).
          cleanupOutdatedCaches: true,
          // Offline app shell: SPA navigations fall back to the precached
          // index.html when the network is unavailable.
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        },
        manifest: {
          id: '/',
          name: 'Apex Growth CRM',
          short_name: 'Apex CRM',
          description: 'Sales CRM by Apex Growth',
          theme_color: '#08090C',
          background_color: '#08090C',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          // Long-press (Android) / right-click (desktop) app-icon shortcuts.
          // Each deep-links via ?tab=, which App reads on boot.
          shortcuts: [
            { name: 'Today', url: '/?tab=today' },
            { name: 'Leads', url: '/?tab=leads' },
            { name: 'Pipeline', url: '/?tab=pipeline' },
          ],
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              // Reuse the 512 as the maskable icon so Android/Chrome installs
              // get a properly-shaped adaptive icon instead of a shrunk logo in
              // a white circle. NOTE: icon-512.png is a full-bleed square; a
              // dedicated maskable asset with ~10% safe-area padding would be
              // ideal if the logo edges ever get clipped by the mask.
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split the Firebase SDK into its own long-cached vendor chunk. It's
          // the bulk of the old ~855 kB entry chunk and rarely changes, so
          // isolating it (a) shrinks the app-code entry chunk and (b) lets
          // browsers reuse the cached Firebase chunk across app deploys.
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase') || id.includes('@firebase')) {
                return 'firebase-vendor';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Allow tunneled previews (localtunnel, cloudflared, ngrok). Safe for dev.
      allowedHosts: ['.loca.lt', '.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    },
  };
});
