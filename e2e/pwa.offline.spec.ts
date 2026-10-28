// End-to-end, SD-18 (PWA: offline and update), on the production build with the real service worker
// of the build (project chromium-360x640-offline, its own server and build folder)
// (analyst/features/react-port/us-10-pwa.md → "Офлайн", "Обновление новой версии";
// architecture/react-port/pwa.md in the workspace):
// - the offline part is registered once, as /Slowo-dnia/sw.js with the scope /Slowo-dnia/
//   (architecture/react-port/release.md → "Ключевые условия перехода");
// - opened once with the network (kids course, the adult one never opened), then without the network:
//   the page opens from the offline part, the fonts Nunito and Caveat (Cyrillic, Latin, Polish) and
//   the icons load, every tab opens, new and old addresses (`#/plan`, `#quiz`, `index.html#settings`)
//   open their tab, "Назад" switches tabs, a word is marked, Settings switch to the adult course and
//   back;
// - every request of the page and of the service worker stays on the site's origin;
// - two builds in a row: with the network the second build is shown on the first open, no reload;
//   its offline part then holds only the second build's set (no files of the first, no prototype
//   cache `slowo-dnia-*`) and storage is untouched; without the network the second build opens whole.
// Not here: the set and the manifest of the build -> tests/pwa-build.acceptance.test.ts; the
// registration condition and the page/legacy cache logic on fakes -> src/platform/serviceWorker.test.ts,
// src/pwa/offline.test.ts; tabs and addresses with the network -> e2e/tabs-history.spec.ts; the
// transition from the real prototype and its cache `slowo-dnia-v6` ->
// e2e/release-transition.offline.spec.ts.
// The two-builds test rebuilds OFFLINE_SERVER.outDir: every test that reads that folder stays in this
// file, run in order (a test that rebuilds it in another file would race with these). For repeated
// runs use `--workers=1`: copies of this file in parallel workers rebuild the folder at once.
import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build, type Plugin } from 'vite'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import settings from '../src/i18n/locales/ru/settings.json' with { type: 'json' }
import start from '../src/i18n/locales/ru/start.json' with { type: 'json' }
import word from '../src/i18n/locales/ru/word.json' with { type: 'json' }
import { OFFLINE_SERVER } from './servers'
import { collectPageErrors, readStorage, seedStorage } from './support'

test.describe.configure({ mode: 'default' })

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, OFFLINE_SERVER.outDir)
const ORIGIN = new URL(OFFLINE_SERVER.baseUrl).origin

type TabName = keyof Omit<typeof common.tabs, 'label'>
const TABS: TabName[] = ['word', 'quiz', 'plan', 'help', 'settings']

const tab = (page: Page, name: TabName) => page.getByRole('tab', { name: common.tabs[name] })

async function expectTab(page: Page, name: TabName): Promise<void> {
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
  expect(new URL(page.url()).hash).toBe(`#/${name}`)
}

/** Every request of the context: the pages' and the service worker's own. */
function collectRequests(context: BrowserContext): Request[] {
  const requests: Request[] = []
  context.on('request', (request) => requests.push(request))
  return requests
}

/** The offline part is installed (its set is in the cache) and controls the page. */
async function waitForOfflinePart(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

async function chooseKids(page: Page): Promise<void> {
  await page.goto('./')
  await page.getByRole('button', { name: start.kids.title }).click()
  await expectTab(page, 'word')
}

/** A new document (not a hash change of the open one): the request goes through the offline part. */
async function openAddress(page: Page, address: string) {
  await page.goto('about:blank')
  return page.goto(address)
}

const courseButton = (page: Page, name: 'kids' | 'adult') =>
  page.getByRole('group', { name: settings.course.label }).getByRole('button', {
    name: settings.course[name],
  })

const courseChip = (page: Page) => page.getByRole('button', { name: common.courseChip.label })

test('opened once with the network, the app works without it, adult course included', async ({
  page,
  context,
}) => {
  const errors = collectPageErrors(page)
  const requests = collectRequests(context)
  await chooseKids(page)
  await waitForOfflinePart(page)
  // The address and scope of the prototype's service worker: the browser updates that registration.
  expect(
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      return registrations.map((r) => [r.scope, r.active?.scriptURL])
    }),
  ).toEqual([[OFFLINE_SERVER.baseUrl, `${OFFLINE_SERVER.baseUrl}sw.js`]])
  // The adult course was never opened by the page; only the offline part fetched it into its set.
  const isAdultCourse = (request: Request) => /\/assets\/adult-[^/]+\.json$/.test(request.url())
  expect(requests.filter((r) => isAdultCourse(r) && r.serviceWorker() === null)).toEqual([])

  await context.setOffline(true)

  const reloaded = await page.reload()
  expect(reloaded?.fromServiceWorker()).toBe(true)
  await expectTab(page, 'word')

  // Fonts of every subset, as with the network: each face of both families loads from the cache.
  const faces = await page.evaluate(async () => {
    const text = 'Привет Ёжик Dzien dobry łęąśćżźńó ŁĘĄŚĆŻŹŃÓ'
    await document.fonts.load('16px Nunito', text)
    await document.fonts.load('16px Caveat', text)
    return [...document.fonts]
      .filter((face) => /^(Nunito|Caveat)$/.test(face.family.replace(/"/g, '')))
      .map((face) => `${face.family} ${face.unicodeRange}: ${face.status}`)
  })
  expect(faces).toHaveLength(6)
  for (const face of faces) expect(face).toMatch(/: loaded$/)

  // Icons and the manifest of the installed app.
  const files = await page.evaluate(() =>
    Promise.all(
      [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'manifest.webmanifest',
      ].map(async (url) => `${url} ${String((await fetch(url)).status)}`),
    ),
  )
  for (const file of files) expect(file).toMatch(/ 200$/)

  // A mark works: the progress is written.
  await page.getByRole('button', { name: new RegExp(`${word.learned.mark}$`) }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('done'))).toMatch(/^\[\d+\]$/)

  for (const name of TABS) {
    await tab(page, name).click()
    await expectTab(page, name)
  }

  // New and old addresses open their tab from the offline part; "Назад" switches tabs.
  for (const [address, name] of [
    ['./#/plan', 'plan'],
    ['./#quiz', 'quiz'],
    ['./index.html#settings', 'settings'],
  ] as const) {
    const opened = await openAddress(page, address)
    expect(opened?.fromServiceWorker(), address).toBe(true)
    await expectTab(page, name)
  }
  await tab(page, 'help').click()
  await expectTab(page, 'help')
  await page.goBack()
  await expectTab(page, 'settings')

  // The adult course, never opened before, comes from the offline part; then back to kids.
  for (const course of ['adult', 'kids'] as const) {
    await tab(page, 'settings').click()
    await courseButton(page, course).click()
    await expect(courseButton(page, course)).toHaveAttribute('aria-pressed', 'true')
    await tab(page, 'word').click()
    await expect(courseChip(page)).toHaveText(new RegExp(common.course[course]))
  }
  await expect(page.getByText(common.toast.courseLoadFailed)).toHaveCount(0)

  // No request, of the page or of the service worker, leaves the site.
  const foreign = requests
    .map((request) => request.url())
    .filter((url) => !/^(data|blob):/.test(url) && new URL(url).origin !== ORIGIN)
  expect(foreign).toEqual([])
  expect(errors).toEqual([])
})

/** A build of the app marked with its version: in the page (`<meta>`) and in its code. */
async function buildVersion(version: string): Promise<string[]> {
  const marker: Plugin = {
    name: 'e2e-build-version',
    transform(code, id) {
      if (!id.endsWith('/src/main.tsx')) return null
      return `${code}\ndocument.documentElement.dataset.e2eBuild = ${JSON.stringify(version)}\n`
    },
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'e2e-build', content: version }, injectTo: 'head' },
    ],
  }
  await build({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [marker],
    build: { outDir: OUT_DIR, emptyOutDir: true },
  })
  const sw = readFileSync(join(OUT_DIR, 'sw.js'), 'utf8')
  const list = /\[\{"revision":[^\]]*\}\]/.exec(sw)?.[0] ?? '[]'
  return (JSON.parse(list) as { url: string }[]).map((entry) => entry.url)
}

const pageVersion = (page: Page) =>
  page.evaluate(() => ({
    page: document.querySelector('meta[name="e2e-build"]')?.getAttribute('content'),
    code: document.documentElement.dataset.e2eBuild,
  }))

/** Cache Storage of the site: cache name → paths of its entries (without Workbox's revision). */
const cacheContents = (page: Page) =>
  page.evaluate(async () => {
    const all: Record<string, string[]> = {}
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys()
      all[name] = keys.map((key) => new URL(key.url).pathname.replace(/^\/Slowo-dnia\//, '')).sort()
    }
    return all
  })

test('two builds in a row: the second is shown on the first open and replaces the first', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  const errors = collectPageErrors(page)

  const first = await buildVersion('v1')
  // Progress in the prototype's format, as a returning user has it.
  await seedStorage(page, {
    course: '"kids"',
    done: '[1,2,3]',
    days: '["2026-10-27","2026-10-28"]',
    theme: '"light"',
  })
  await page.goto('./')
  await expectTab(page, 'word')
  await waitForOfflinePart(page)
  expect(await pageVersion(page)).toEqual({ page: 'v1', code: 'v1' })
  // The prototype's cache, as an installed user of the prototype has it.
  await page.evaluate(async () => {
    const legacy = await caches.open('slowo-dnia-v6')
    await legacy.put('./index.html', new Response('prototype page'))
  })
  const storage = await readStorage(page)

  const second = await buildVersion('v2')
  const firstOnly = first.filter((url) => !second.includes(url))
  expect(firstOnly.length).toBeGreaterThan(0)

  // With the network: the second build on the first open, without a reload.
  await page.goto('./')
  expect(await pageVersion(page)).toEqual({ page: 'v2', code: 'v2' })
  await expectTab(page, 'word')

  // Its offline part takes over: only the second build's set stays in Cache Storage.
  const expected = [...second].sort()
  await expect
    .poll(async () => Object.values(await cacheContents(page)), { timeout: 30_000 })
    .toEqual([expected])
  expect(Object.keys(await cacheContents(page))).toEqual([
    expect.stringMatching(/^workbox-precache-v2-/),
  ])
  expect(await readStorage(page)).toEqual(storage)

  // Without the network: the second build, whole.
  await context.setOffline(true)
  const reloaded = await page.reload()
  expect(reloaded?.fromServiceWorker()).toBe(true)
  expect(await pageVersion(page)).toEqual({ page: 'v2', code: 'v2' })
  await expectTab(page, 'word')
  expect(await readStorage(page)).toEqual(storage)
  expect(errors).toEqual([])
})
