// End-to-end, SD-12 ("The adult course did not load" at start), on the production build with the real
// course loader, the real fetch of the adult course file and the real page reload
// (analyst/features/react-port/us-1-start.md → "Взрослый курс не загрузился при запуске";
// architecture/react-port/course-data.md → "Ошибка загрузки (П-6)";
// decisions/stack/2026-10-26-course-retry-reload.md (С-12) in the workspace):
// - no network: the screen is read by screen readers (heading, message, button in the
//   accessibility tree), without tabs; the address and the storage stay as they were;
// - the button is reached and pressed with the keyboard; on a network error it makes a new request,
//   no reload, a toast shows the attempt; with the network back the adult course opens on the tab of
//   the address;
// - 404 and a broken file: the button reloads the page, no new request before it; storage unchanged.
// Not here (developer, fake loader): the only button, the toast text and the storage after every
// outcome, a press while loading, network then 404 ->
// src/features/course-error/CourseErrorScreen.test.tsx; the store side -> src/state/appStore.test.ts;
// error kinds of the loader -> src/data/loadCourse.test.ts.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import start from '../src/i18n/locales/ru/start.json' with { type: 'json' }
import { ADULT_COURSE_URL, collectPageErrors, readStorage, seedStorage } from './support'

const ADULT = { course: '"adult"', done: '[1,2]', 'adult:days': '["2026-10-25"]' }

function countAdultRequests(page: Page): () => number {
  let count = 0
  page.on('request', (request) => {
    if (/\/assets\/adult-[^/]*\.json$/.test(new URL(request.url()).pathname)) count += 1
  })
  return () => count
}

const retryButton = (page: Page) => page.getByRole('button', { name: start.adultFailed.retry })

async function expectErrorScreen(page: Page): Promise<void> {
  // JSON strings are valid YAML scalars: the texts come from the dictionary as they are.
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - main:
      - heading ${JSON.stringify(common.appName)} [level=1]
      - paragraph: ${JSON.stringify(start.adultFailed.text)}
      - button ${JSON.stringify(start.adultFailed.retry)}
  `)
  await expect(page.getByRole('tablist')).toHaveCount(0)
}

/** A mark in the page's memory: it is gone only after the page reloads. */
const mark = (page: Page) =>
  page.evaluate(() => {
    ;(window as Window & { e2eMark?: true }).e2eMark = true
  })
const marked = (page: Page) =>
  page.evaluate(() => (window as Window & { e2eMark?: true }).e2eMark === true)

test('no network: readable screen, keyboard retry makes a new request, then the course opens', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  const requests = countAdultRequests(page)
  await seedStorage(page, ADULT)
  await page.route(ADULT_COURSE_URL, (route) => route.abort('internetdisconnected'))

  await page.goto('./#/quiz')
  await expectErrorScreen(page)
  expect(new URL(page.url()).hash).toBe('#/quiz')
  expect(await readStorage(page)).toEqual(ADULT)
  await mark(page)

  await page.keyboard.press('Tab')
  await expect(retryButton(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText(common.toast.courseLoadFailed)
  expect(requests()).toBe(2)
  expect(await marked(page)).toBe(true)
  await expectErrorScreen(page)
  expect(await readStorage(page)).toEqual(ADULT)

  await page.unroute(ADULT_COURSE_URL)
  await retryButton(page).press('Enter')
  await expect(page.getByRole('tab', { name: common.tabs.quiz })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(await marked(page)).toBe(true)
  expect(errors).toEqual([])
})

for (const [kind, body, status] of [
  ['not-found', 'Not Found', 404],
  ['invalid', '{"not": "a course"', 200],
] as const) {
  test(`${kind}: the button reloads the page, no new request before it`, async ({ page }) => {
    const requests = countAdultRequests(page)
    await seedStorage(page, ADULT)
    await page.route(ADULT_COURSE_URL, (route) =>
      route.fulfill({ status, contentType: 'application/json', body }),
    )

    await page.goto('./#/plan')
    await expectErrorScreen(page)
    expect(requests()).toBe(1)
    await mark(page)

    await Promise.all([page.waitForEvent('load'), retryButton(page).click()])
    expect(await marked(page)).toBe(false)
    await expectErrorScreen(page)
    // One request: the start-up of the reloaded page.
    expect(requests()).toBe(2)
    expect(new URL(page.url()).hash).toBe('#/plan')
    expect(await readStorage(page)).toEqual(ADULT)
  })
}
