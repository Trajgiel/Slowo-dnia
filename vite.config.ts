/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  plugins: [react()],
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...VITEST_DEFAULT_EXCLUDE, E2E_TESTS],
  },
})
