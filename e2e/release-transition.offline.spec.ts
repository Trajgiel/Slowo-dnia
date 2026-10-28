// End-to-end, SD-20 (the release): an installed prototype with progress moves to the React build
// published on the same address (analyst/features/react-port/us-11-release.md → "Переход
// установленного приложения и открытой вкладки"; architecture/react-port/release.md → "Ключевые
// условия перехода", "Первое открытие после выпуска (с сетью)", "Проверка перехода до выпуска" in the
// workspace). One scenario, criteria of the task:
// 1. after the switch the first open with the network shows the React build, and `localStorage` is
//    the one the prototype left, character for character;
// 2. one registration of the offline part, `/Slowo-dnia/sw.js` with the scope `/Slowo-dnia/`;
// 3. no `slowo-dnia-v6` (no `slowo-dnia-*` at all) in Cache Storage;
// 4. the next open without the network is the React build, whole (no failed request), and the
//    adult course opens;
// 5. the old prototype address `#quiz` opens its tab after the transition.
// How: a small static server of this test serves the published prototype at /Slowo-dnia/ (git
// commit PROTOTYPE_COMMIT of this repository, the files of materials/project in the workspace; or
// PROTOTYPE_DIR), its offline part v6 becomes active, progress is made in both courses by clicks in the
// prototype; then the server serves the React build (MAIN_SERVER.outDir, built by the screens
// project's web server and never rebuilt by a test) instead, on the same origin.
// Not here: the React build alone, offline and update (fonts, icons, tabs, two builds in a row) ->
// e2e/pwa.offline.spec.ts; old addresses with the network -> e2e/tabs-history.spec.ts; prototype
// storage formats read by the app -> unit tests of src/storage and src/state.
import { expect, test, type Page, type Request } from '@playwright/test'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import { preparePrototype } from './prototype-site'
import { MAIN_SERVER } from './servers'
import { collectPageErrors, readStorage } from './support'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REACT_DIR = join(ROOT, MAIN_SERVER.outDir)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

interface Site {
  /** The folder served at /Slowo-dnia/: the prototype, then the React build. */
  dir: string
  baseUrl: string
  server: Server
}

/**
 * A static site at /Slowo-dnia/, like GitHub Pages, whose folder can be replaced. No HTTP caching
 * (`no-store`): Pages allows 10 minutes, which would only delay the transition in this test by that.
 */
async function startSite(dir: string): Promise<Site> {
  const site = { dir } as Site
  site.server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://site').pathname)
    let file = path.startsWith('/Slowo-dnia/')
      ? resolve(site.dir, `.${path.slice('/Slowo-dnia'.length)}`)
      : ''
    if (file && !file.startsWith(site.dir + sep) && file !== site.dir) file = ''
    try {
      if (file && statSync(file).isDirectory()) file = join(file, 'index.html')
      if (!file || !statSync(file).isFile()) throw new Error('not a file')
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((done) => site.server.listen(0, '127.0.0.1', done))
  const { port } = site.server.address() as AddressInfo
  site.baseUrl = `http://127.0.0.1:${String(port)}/Slowo-dnia/`
  return site
}

/** Texts of the prototype fixture (its index.html), not of the app. */
const PROTO = {
  kids: /Ребёнок/,
  learned: 'Выучили',
  next: 'Следующее слово',
  tab: { word: 'Слово', quiz: 'Опрос', settings: 'Настройки' },
  show: 'Показать ответ',
  yes: 'Ответили ✓',
  no: 'Не вспомнили',
  dirPl: 'Польский → русский',
  free: 'Без конца',
  boy: 'Мальчик',
  light: 'Светлая',
  adult: 'Для взрослых · 1000',
}

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' })

async function protoTab(page: Page, name: keyof typeof PROTO.tab): Promise<void> {
  await page.getByRole('tab', { name: PROTO.tab[name] }).click()
  await expect(page.getByRole('tab', { name: PROTO.tab[name] })).toHaveAttribute(
    'aria-selected',
    'true',
  )
}

/** "Выучили" on `count` words in a row, from the current one. */
async function learnWords(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    if (i > 0) await button(page, PROTO.next).click()
    await button(page, PROTO.learned).click()
    await expect(button(page, `✓ ${PROTO.learned}`)).toBeVisible()
  }
}

async function answerCard(page: Page, answer: 'yes' | 'no'): Promise<void> {
  await button(page, PROTO.show).click()
  await button(page, PROTO[answer]).click()
}

/** Cache Storage of the page's origin: the names of its caches. */
const cacheNames = (page: Page) => page.evaluate(() => caches.keys())

const registrations = (page: Page) =>
  page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map((r) => ({
      scope: r.scope,
      active: r.active?.scriptURL,
      waiting: r.waiting?.scriptURL,
      installing: r.installing?.scriptURL,
    })),
  )

type TabName = keyof Omit<typeof common.tabs, 'label'>

/** A tab of the React build: its address `#/<tab>` exists only there, never in the prototype. */
async function expectReactTab(page: Page, name: TabName): Promise<void> {
  await expect(page.getByRole('tab', { name: common.tabs[name] })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(new URL(page.url()).hash).toBe(`#/${name}`)
  await expect(page.locator('#root')).not.toBeEmpty()
  await expect(page.locator('#v-word')).toHaveCount(0)
}

/** Polish words and phrases of the adult course: [theme, [[pl, ru, transcription], ...]][]. */
const adultWords: string[] = (
  JSON.parse(readFileSync(join(ROOT, 'src/data/adult.json'), 'utf8')) as [
    string,
    [string, ...string[]][],
  ][]
).flatMap(([, words]) => words.map((w) => w[0]))

let site: Site | undefined
test.afterEach(async () => {
  const current = site
  site = undefined
  if (current) await new Promise((done) => current.server.close(done))
})

test('the installed prototype with progress moves to the React build on the first open', async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  site = await startSite(preparePrototype(testInfo.outputPath('prototype')))
  const base = site.baseUrl

  // --- The prototype, installed: its offline part v6 is active and controls the page. ---
  await page.goto(base)
  // The prototype registers sw.js only over https (index.html: location.protocol === "https:");
  // the test server is http on 127.0.0.1, a secure context too, so the test makes the prototype's
  // own call: same script, same default scope.
  await page.evaluate(() => navigator.serviceWorker.register('sw.js'))
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toBe(`${base}sw.js`)
  expect(await cacheNames(page)).toEqual(['slowo-dnia-v6'])
  // Every next request of the prototype goes through v6, as on the user's phone.
  expect((await page.reload())?.fromServiceWorker()).toBe(true)

  // --- Progress in both courses, by clicks. ---
  // Kids: three words learned; deck "ru" two of three answered, deck "pl" solved with one
  // "Не вспомнили" (so a word stays "forgotten" whatever the shuffle).
  await button(page, PROTO.kids).click()
  await learnWords(page, 3)
  await protoTab(page, 'quiz')
  await answerCard(page, 'yes')
  await answerCard(page, 'no')
  await button(page, PROTO.dirPl).click()
  for (const answer of ['yes', 'yes', 'no'] as const) await answerCard(page, answer)
  await protoTab(page, 'settings')
  await button(page, PROTO.boy).click()
  await button(page, PROTO.light).click()
  // Adult: the course file comes from v6; two words learned, deck "pl" started with
  // "Не вспомнили", mode "Без конца".
  await button(page, PROTO.adult).click()
  await expect(button(page, PROTO.adult)).toHaveAttribute('aria-pressed', 'true')
  await protoTab(page, 'word')
  await learnWords(page, 2)
  await protoTab(page, 'quiz')
  await answerCard(page, 'no')
  await button(page, PROTO.free).click()
  await protoTab(page, 'word')

  const before = await readStorage(page)
  // The scenario did fill both courses (else the comparison below would prove little).
  expect(Object.keys(before)).toEqual(
    expect.arrayContaining([
      'course',
      'theme',
      'qmode',
      'qdir',
      'tab',
      'done',
      'days',
      'weak',
      'kid',
      'deck_ru',
      'deck_pl',
      'last_pl',
      'adult:done',
      'adult:days',
      'adult:weak',
      'adult:deck_pl',
    ]),
  )
  expect(JSON.parse(before['adult:done'] ?? '')).toHaveLength(2)
  for (const key of ['weak', 'adult:weak']) expect(before[key], key).not.toBe('{}')
  await page.close()

  // --- The release: the same address now serves the React build. ---
  site.dir = REACT_DIR

  // Criterion 1: the first open with the network (through v6, page from the network) is React.
  const app = await context.newPage()
  const errors = collectPageErrors(app)
  const first = await app.goto(base)
  expect(first?.fromServiceWorker()).toBe(true)
  await expectReactTab(app, 'word')
  await expect(app.getByRole('button', { name: common.courseChip.label })).toHaveText(
    new RegExp(common.course.adult),
  )

  // Criterion 3: the new offline part takes over and removes the prototype's cache.
  await expect
    .poll(() => cacheNames(app), { timeout: 30_000 })
    .toEqual([expect.stringMatching(/^workbox-precache-v2-/)])
  await expect
    .poll(() => app.evaluate(() => navigator.serviceWorker.controller?.state ?? null))
    .toBe('activated')
  // Criterion 2: still one registration, the prototype's address and scope, nothing waiting.
  expect(await registrations(app)).toEqual([
    { scope: base, active: `${base}sw.js`, waiting: undefined, installing: undefined },
  ])
  // Criterion 1: storage untouched, character for character.
  expect(await readStorage(app)).toEqual(before)
  await app.close()

  // Criteria 4 and 5: the next open, without the network, at the prototype's old address `#quiz`.
  await context.setOffline(true)
  const offline = await context.newPage()
  const offlineErrors = collectPageErrors(offline)
  const failed: Request[] = []
  offline.on('requestfailed', (request) => failed.push(request))
  const reopened = await offline.goto(`${base}#quiz`)
  expect(reopened?.fromServiceWorker()).toBe(true)
  await expectReactTab(offline, 'quiz')
  await offline.getByRole('tab', { name: common.tabs.word }).click()
  await expectReactTab(offline, 'word')
  await expect(offline.getByRole('button', { name: common.courseChip.label })).toHaveText(
    new RegExp(common.course.adult),
  )
  // The card shows a word of the adult course (the file comes from the cache, not from the network).
  const shown = (await offline.locator('p.pl[lang="pl"]').first().textContent()) ?? ''
  expect(adultWords).toContain(shown.trim())
  // The whole build is there: fonts included (the word tab uses both families).
  await offline.evaluate(() => document.fonts.ready)
  expect(failed.map((request) => request.url())).toEqual([])
  expect([...errors, ...offlineErrors]).toEqual([])
  // v6 writes to its cache outside `waitUntil`: a late write could recreate `slowo-dnia-v6`.
  expect(await cacheNames(offline)).toEqual([expect.stringMatching(/^workbox-precache-v2-/)])
})
