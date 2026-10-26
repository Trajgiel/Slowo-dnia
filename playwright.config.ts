import { defineConfig, devices } from '@playwright/test'

// End-to-end tests (qa): the app in a real browser. `npm run test:e2e`; CI job `e2e`.
// Unlike the preset (Vite dev server), the tests run against the production build served by
// `vite preview`: in dev Vite injects CSS from JavaScript, so the first paint, fonts and the
// <head> differ from what GitHub Pages serves. The build goes to its own folder, so `dist/`
// of `npm run build` is not touched. A port of its own, so a running server is never reused.
const PORT = 5199
const OUT_DIR = 'node_modules/.cache/e2e-dist'
// GitHub Pages base path (vite.config.ts → base).
const BASE_URL = `http://127.0.0.1:${String(PORT)}/Slowo-dnia/`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // A small phone: the smallest screen the design briefs check.
      name: 'chromium-360x640',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite build --outDir ${OUT_DIR} --emptyOutDir --logLevel error && npx vite preview --outDir ${OUT_DIR} --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
