import { defineConfig, devices } from '@playwright/test'
import { MAIN_SERVER, OFFLINE_SERVER, type E2eServer } from './e2e/servers'

// End-to-end tests (qa): the app in a real browser. `npm run test:e2e`; CI job `e2e`.
// Unlike the preset (Vite dev server), the tests run against the production build served by
// `vite preview`: in dev Vite injects CSS from JavaScript, so the first paint, fonts and the
// <head> differ from what GitHub Pages serves. Each server builds to its own folder, so `dist/`
// of `npm run build` is not touched. Ports of their own, so a running server is never reused.
//
// Two projects (architecture/react-port/pwa.md in the workspace → "Локально и в тестах"):
// - screens: the service worker is blocked, so `page.route` sees every request of the page
//   (a request answered by a service worker never reaches `page.route`);
// - offline (`*.offline.spec.ts`): the service worker of the build is registered — 127.0.0.1 is a
//   secure context — on a server and folder of its own: a test may rebuild that folder
//   (OFFLINE_SERVER.outDir; `vite preview` reads files from disk on every request) without
//   touching the screens project, and the service worker lives on its own origin.
const OFFLINE_TESTS = '**/*.offline.spec.ts'

// A small phone: the smallest screen the design briefs check.
const SMALL_PHONE = {
  ...devices['Desktop Chrome'],
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 2,
  hasTouch: true,
}

const previewServer = ({ port, outDir, baseUrl }: E2eServer) => ({
  command: `npx vite build --outDir ${outDir} --emptyOutDir --logLevel error && npx vite preview --outDir ${outDir} --host 127.0.0.1 --port ${String(port)} --strictPort`,
  url: baseUrl,
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: 'ignore' as const,
  stderr: 'pipe' as const,
})

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-360x640',
      testIgnore: OFFLINE_TESTS,
      use: { ...SMALL_PHONE, baseURL: MAIN_SERVER.baseUrl, serviceWorkers: 'block' },
    },
    {
      name: 'chromium-360x640-offline',
      testMatch: OFFLINE_TESTS,
      use: { ...SMALL_PHONE, baseURL: OFFLINE_SERVER.baseUrl, serviceWorkers: 'allow' },
    },
  ],
  webServer: [previewServer(MAIN_SERVER), previewServer(OFFLINE_SERVER)],
})
