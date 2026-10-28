// Servers of the end-to-end tests (playwright.config.ts): the production build under `vite preview`
// at the GitHub Pages base path (vite.config.ts → base).

export interface E2eServer {
  port: number
  /** Build folder served by this server, relative to the project root. */
  outDir: string
  baseUrl: string
}

const server = (port: number, outDir: string): E2eServer => ({
  port,
  outDir,
  baseUrl: `http://127.0.0.1:${String(port)}/Slowo-dnia/`,
})

/** Project `chromium-360x640`: screens, service worker blocked. */
export const MAIN_SERVER = server(5199, 'node_modules/.cache/e2e-dist')

/** Project `chromium-360x640-offline` (`*.offline.spec.ts`): the service worker is registered. */
export const OFFLINE_SERVER = server(5198, 'node_modules/.cache/e2e-dist-offline')
