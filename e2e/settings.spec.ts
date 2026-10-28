// End-to-end, SD-16 ("Настройки"), on the production build with the real course loader and the real
// adult course file (analyst/features/react-port/us-6-settings.md; us-5-plan-help.md → "План" in the
// workspace):
// - another course and back: it loads, `course` is written, its own progress opens (word, gender,
//   plan of 100 / 71 themes, course chip), the page stays on "Настройки"; the progress keys of both
//   courses are the same after the round trip;
// - the adult course does not load from "Настройки" (real request, no network): the toast, the kids
//   course stays chosen with its texts, the page stays, nothing is written;
// - "Тема": a press changes the page colors and the browser bar color at once (main.tsx wiring; what
//   is written -> SettingsScreen.test.tsx "theme: …");
// - "Контакты": two columns from 480 px, one column below.
// Not here (developer, jsdom): card order and texts, pressed states, gender, what the store writes
// and keeps -> src/features/settings/SettingsScreen.test.tsx, src/state/appStore.settings.test.ts;
// gender on every tab -> src/features/settings/gender.acceptance.test.tsx; theme before the first
// paint -> e2e/theme-before-paint.spec.ts; the error screen at start -> e2e/course-error.spec.ts.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import settings from '../src/i18n/locales/ru/settings.json' with { type: 'json' }
import word from '../src/i18n/locales/ru/word.json' with { type: 'json' }
import { ADULT_COURSE_URL, box, collectPageErrors, fill, readStorage, seedStorage } from './support'

const PROGRESS = {
  course: '"kids"',
  done: '[0,1,2]',
  weak: '{"1":2}',
  days: '["2026-10-25"]',
  deck_ru: '{"order":[2,0,1],"ans":{"2":true}}',
  last_ru: '{"right":3,"wrong":0,"total":3,"date":"2026-10-20"}',
  'adult:done': '[0,1,2,3,4]',
  'adult:weak': '{"4":1}',
  'adult:days': '["2026-10-24"]',
  'adult:kid': '"boy"',
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })
const courseButton = (page: Page, name: string) =>
  page.getByRole('group', { name: settings.course.label }).getByRole('button', { name })

/** Word position on "Слово" and the number of themes on "План"; back to "Настройки". */
async function expectCourse(page: Page, n: number, total: number, themes: number, chip: string) {
  await tab(page, common.tabs.word).click()
  await expect(page.locator('.card.word')).toContainText(fill(word.meta.position, { n, total }))
  await expect(page.getByRole('button', { name: common.courseChip.label })).toHaveText(chip)
  await tab(page, common.tabs.plan).click()
  await expect(page.locator('.plan details')).toHaveCount(themes)
  await tab(page, common.tabs.settings).click()
}

test('another course and back: its own progress opens, the page stays, both courses are kept', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await seedStorage(page, PROGRESS)
  await page.goto('./#/settings')

  await courseButton(page, settings.course.adult).click()
  await expect(courseButton(page, settings.course.adult)).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(page.url()).hash).toBe('#/settings')
  await expect(page.getByRole('button', { name: settings.kid.adult.boy })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect((await readStorage(page)).course).toBe('"adult"')
  await expectCourse(page, 6, 1000, 100, common.course.adult)

  await courseButton(page, settings.course.kids).click()
  await expect(courseButton(page, settings.course.kids)).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(page.url()).hash).toBe('#/settings')
  await expect(page.getByRole('button', { name: settings.kid.kids.girl })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expectCourse(page, 4, 500, 71, common.course.kids)

  // Opening a course reconciles its deck (architecture/react-port/storage.md → "Когда что пишется",
  // as the prototype's course switch): the adult course had none, so a deck of its learned words.
  const { tab: storedTab, 'adult:deck_ru': adultDeck, ...rest } = await readStorage(page)
  expect(storedTab).toBe('"settings"')
  expect(rest).toEqual(PROGRESS)
  const deck = JSON.parse(adultDeck ?? 'null') as { order: number[]; ans: object }
  expect([...deck.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  expect(deck.ans).toEqual({})
  expect(errors).toEqual([])
})

test('the adult course does not load from "Настройки": toast, the kids course stays, nothing written', async ({
  page,
}) => {
  await seedStorage(page, PROGRESS)
  await page.route(ADULT_COURSE_URL, (route) => route.abort('internetdisconnected'))
  await page.goto('./#/settings')
  const before = await readStorage(page)

  await courseButton(page, settings.course.adult).click()
  await expect(
    page.getByRole('status').filter({ hasText: common.toast.courseLoadFailed }),
  ).toBeVisible()
  await expect(courseButton(page, settings.course.kids)).toHaveAttribute('aria-pressed', 'true')
  await expect(courseButton(page, settings.course.adult)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText(settings.kid.hint.kids)).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/settings')
  expect(await readStorage(page)).toEqual(before)
})

test('"Тема": a press changes the page and the browser bar color at once', async ({ page }) => {
  await seedStorage(page, { course: '"kids"' })
  await page.goto('./#/settings')
  const colors = () =>
    page.evaluate(() => ({
      paper: getComputedStyle(document.body).backgroundColor,
      bar: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (m) => m.content,
      ),
    }))
  expect(await colors()).toEqual({ paper: 'rgb(18, 24, 38)', bar: ['#121826'] })

  await page.getByRole('button', { name: settings.theme.light }).click()
  await expect.poll(colors).toEqual({ paper: 'rgb(246, 248, 252)', bar: ['#f6f8fc'] })

  await page.getByRole('button', { name: settings.theme.dark }).click()
  await expect.poll(colors).toEqual({ paper: 'rgb(18, 24, 38)', bar: ['#121826'] })
})

for (const [width, columns] of [
  [480, 2],
  [479, 1],
] as const) {
  test.describe(`width ${String(width)}`, () => {
    test.use({ viewport: { width, height: 640 } })

    test(`"Контакты": ${String(columns)} column(s)`, async ({ page }) => {
      await seedStorage(page, { course: '"kids"' })
      await page.goto('./#/settings')
      const telegram = await box(page.getByRole('link', { name: settings.contacts.telegram }))
      const linkedin = await box(page.getByRole('link', { name: settings.contacts.linkedin }))
      if (columns === 2) {
        expect(linkedin.y).toBe(telegram.y)
        expect(linkedin.x).toBeGreaterThanOrEqual(telegram.x + telegram.width)
      } else {
        expect(linkedin.x).toBe(telegram.x)
        expect(linkedin.y).toBeGreaterThanOrEqual(telegram.y + telegram.height)
      }
    })
  })
}
