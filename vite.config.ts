/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// End-to-end tests run in a real browser under Playwright (`npm run test:e2e`), never in Vitest.
const E2E_TESTS = 'e2e/**'
// Vitest's own default exclude (configDefaults.exclude), written out so the dev
// server does not load vitest just to read its config.
const VITEST_DEFAULT_EXCLUDE = ['**/node_modules/**', '**/.git/**']

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site at https://trajgiel.github.io/Slowo-dnia/.
  // In code the base path comes only from import.meta.env.BASE_URL.
  base: '/Slowo-dnia/',
  plugins: [
    react(),
    // Offline part (architecture/react-port/pwa.md in the workspace): our own service worker
    // src/pwa/sw.ts on Workbox modules; the plugin only builds it to /Slowo-dnia/sw.js (the address
    // of the prototype's service worker) and injects the list of build files (self.__WB_MANIFEST).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      // public/manifest.webmanifest is the prototype's file; the plugin must not generate its own.
      manifest: false,
      // Registration is ours (src/platform/serviceWorker.ts), without the plugin's reloading modules.
      injectRegister: null,
      // No service worker in `npm run dev`: hot reload and the cache get in each other's way.
      devOptions: { enabled: false },
      injectManifest: {
        // One version = one full set: page, code, adult course, fonts, icons, manifest.
        globPatterns: ['**/*.{js,css,html,json,woff2,png,webmanifest}'],
        // A classic script, registered like the prototype's sw.js (no `type: 'module'`).
        rollupFormat: 'iife',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...VITEST_DEFAULT_EXCLUDE, E2E_TESTS],
  },
})
