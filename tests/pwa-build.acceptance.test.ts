// @vitest-environment node
// Acceptance, SD-18 (PWA), criteria on the production build (`vite build`, as in `npm run build`)
// (analyst/features/react-port/us-10-pwa.md; architecture/react-port/pwa.md and
// architecture/react-port/release.md → "Ключевые условия перехода" in the workspace):
// - the offline part is /Slowo-dnia/sw.js, the address of the prototype's service worker;
// - its set (the list Workbox precaches) is every file of the build by the mask
//   js, css, html, json, woff2, png, webmanifest — page, code, adult course, fonts, icons, manifest —
//   and nothing else: every address of the set exists in the build, `courses/adult.js` of the
//   prototype is not there; files without a hash in the name carry a revision (a changed file of the
//   next version is fetched again);
// - the manifest has the values of the prototype (materials/project/manifest.webmanifest) except
//   `name` (content/ui/app-shell.md → "Манифест"), no `id`, `start_url` and `scope` "./".
// Not here: the service worker in a browser (offline, two builds, foreign requests) ->
// e2e/pwa.offline.spec.ts; the <head> tags -> e2e/head.spec.ts; no other-domain URLs in the build ->
// tests/skeleton-build.acceptance.test.ts.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// materials/project/manifest.webmanifest, with the name rephrased without the long dash.
const PROTOTYPE_MANIFEST = {
  name: 'Słowo dnia: польский на каждый день',
  short_name: 'Słowo dnia',
  description: 'Одно польское слово в день: перевод, транскрипция, озвучка и опрос.',
  lang: 'ru',
  developer: { name: 'Wlodzimierz Trajgiel', url: 'https://www.linkedin.com/in/trajgiel/' },
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#121826',
  theme_color: '#121826',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

const SET_MASK = /\.(js|css|html|json|woff2|png|webmanifest)$/

interface PrecacheEntry {
  url: string
  revision: string | null
}

const root = fileURLToPath(new URL('..', import.meta.url))
let outDir = ''

function files(): string[] {
  return readdirSync(outDir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(outDir, join(entry.parentPath, entry.name)))
}

/** The list vite-plugin-pwa injected into sw.js in place of self.__WB_MANIFEST. */
function precacheSet(): PrecacheEntry[] {
  const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
  const list = /\[\{"revision":[^\]]*\}\]/.exec(sw)
  expect(list, 'the precache list in sw.js').not.toBeNull()
  return JSON.parse(list?.[0] ?? '[]') as PrecacheEntry[]
}

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'slowo-dnia-pwa-'))
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

describe('offline part of the build', () => {
  it('sw.js sits at the root of the site, where the prototype had it', () => {
    expect(files()).toContain('sw.js')
  })

  it('precaches exactly the files of the build by the mask, without courses/adult.js', () => {
    const set = precacheSet().map((entry) => entry.url)
    const expected = files().filter((file) => SET_MASK.test(file) && file !== 'sw.js')

    expect([...set].sort()).toEqual([...expected].sort())
    expect(set).not.toContain('courses/adult.js')
    expect(set).toEqual(
      expect.arrayContaining([
        'index.html',
        'manifest.webmanifest',
        expect.stringMatching(/^assets\/adult-[^/]+\.json$/),
        expect.stringMatching(/^assets\/index-[^/]+\.js$/),
        expect.stringMatching(/^assets\/index-[^/]+\.css$/),
        'fonts/nunito-cyrillic.woff2',
        'fonts/nunito-latin.woff2',
        'fonts/nunito-latin-ext.woff2',
        'fonts/caveat-cyrillic.woff2',
        'fonts/caveat-latin.woff2',
        'fonts/caveat-latin-ext.woff2',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
      ]),
    )
  })

  it('files without a hash in the name carry a revision', () => {
    const unhashed = precacheSet().filter((entry) => !entry.url.startsWith('assets/'))
    expect(unhashed.length).toBeGreaterThan(0)
    for (const entry of unhashed) expect(entry.revision, entry.url).toMatch(/^[0-9a-f]{8,}$/)
  })
})

describe('manifest', () => {
  it('has the values of the prototype, the new full name, no id', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8'))
    expect(manifest).toStrictEqual(PROTOTYPE_MANIFEST)
  })
})
