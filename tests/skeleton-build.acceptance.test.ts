// @vitest-environment node
// Acceptance, SD-6 (skeleton with CI), criteria on the production build (`vite build`, as in `npm run build`):
// - files are served under the GitHub Pages base path /Slowo-dnia/ (index.html refers to /Slowo-dnia/assets/…);
// - the page is <html lang="ru">; icons, fonts with their licenses and LICENSE are on the site;
// - no requests to other domains: the only absolute URLs in the build are known non-request
//   references (decisions/product/2026-10-25-no-analytics-v01.md: the app makes no requests outside).
// Not here: byte equality of public/ with the prototype (checked once by qa against git history);
// lint rules -> skeleton-lint.acceptance.test.ts; the placeholder text -> src/app/App.test.tsx.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const BASE = '/Slowo-dnia/'

// Absolute URLs that libraries keep as plain strings and never request.
// A new host here needs a reason: a real request outside breaks the no-requests decision.
const NON_REQUEST_HOSTS = new Map([
  ['www.w3.org', 'XML namespaces (SVG, MathML, xlink) in react-dom'],
  ['react.dev', 'links in React error messages'],
  ['react.i18next.com', 'link in a react-i18next warning'],
  [
    'www.linkedin.com',
    "the author's link: copyright comment in index.html, later links on the How screen; the app makes no request to it",
  ],
])

const root = fileURLToPath(new URL('..', import.meta.url))
let outDir = ''

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(outDir, join(entry.parentPath, entry.name)))
}

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'slowo-dnia-build-'))
  const env: NodeJS.ProcessEnv = { ...process.env }
  // Vitest sets NODE_ENV=test; the real build runs without it.
  delete env.NODE_ENV
  const result = spawnSync(
    join(root, 'node_modules/.bin/vite'),
    ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: root, env, encoding: 'utf8' },
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
}, 60_000)

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true })
})

describe('production build', () => {
  it('index.html is in Russian and loads its script from /Slowo-dnia/assets/', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(html).toMatch(/<html lang="ru">/)

    const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '')
    const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1] ?? '')
    expect(scripts.length).toBeGreaterThan(0)
    for (const src of scripts) {
      expect(src).toMatch(/^\/Slowo-dnia\/assets\/[^/]+\.js$/)
      expect(existsSync(join(outDir, src.slice(BASE.length)))).toBe(true)
    }
    for (const ref of refs) expect(ref.startsWith(BASE), ref).toBe(true)
  })

  it('puts icons, fonts with their licenses and LICENSE on the site', () => {
    expect(files(outDir)).toEqual(
      expect.arrayContaining([
        'LICENSE',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'fonts/OFL-caveat.txt',
        'fonts/OFL-nunito.txt',
        'fonts/caveat-cyrillic.woff2',
        'fonts/caveat-latin-ext.woff2',
        'fonts/caveat-latin.woff2',
        'fonts/nunito-cyrillic.woff2',
        'fonts/nunito-latin-ext.woff2',
        'fonts/nunito-latin.woff2',
      ]),
    )
  })

  it('has no URLs of other domains in the code and pages', () => {
    const code = files(outDir).filter((file) => /\.(html|js|css|json|webmanifest)$/.test(file))
    const foreign: string[] = []
    for (const file of code) {
      const text = readFileSync(join(outDir, file), 'utf8')
      for (const [, host = ''] of text.matchAll(
        /(?:https?:|wss?:)?\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi,
      )) {
        if (!NON_REQUEST_HOSTS.has(host.toLowerCase())) foreign.push(`${file}: ${host}`)
      }
    }
    expect(foreign).toEqual([])
  })
})
