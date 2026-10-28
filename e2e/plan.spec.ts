// End-to-end, SD-15 ("План"), on the production build with the real hash router, history and scrolling
// (analyst/features/react-port/us-5-plan-help.md → "План"; us-12-details.md in the workspace):
// - opening "План" scrolls the current word to the middle of the screen (not to the top of the page);
// - a press on a word opens "Слово" with that word; "Назад" of the browser returns to "План", where the
//   pressed word is now the current one, again in the middle, and the open themes are as they were.
// Not here (developer, jsdom): theme and word rows, marks, counters, which themes are open when ->
// src/features/plan/PlanScreen.test.tsx, src/state/appStore.plan.test.ts; that the scroll is asked
// for every opening -> PlanScreen.test.tsx "opening the tab scrolls…"; 100 themes of the adult course
// -> e2e/settings.spec.ts; marks and open themes after restore and reset -> e2e/backup.spec.ts.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import word from '../src/i18n/locales/ru/word.json' with { type: 'json' }
import { collectPageErrors, fill, seedStorage } from './support'

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

/** Distance of the current word's middle from the middle of the viewport, in px. */
const offCenter = (page: Page) =>
  page.locator('.plan .item.cur').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return Math.abs(r.top + r.height / 2 - window.innerHeight / 2)
  })

const openThemes = (page: Page) =>
  page
    .locator('.plan details')
    .evaluateAll((all) => all.flatMap((d, i) => ((d as HTMLDetailsElement).open ? [i + 1] : [])))

/** Number of the theme (from 1) that holds the current word. */
const currentTheme = (page: Page) =>
  page
    .locator('.plan details')
    .evaluateAll((all) => all.findIndex((d) => d.querySelector('.item.cur') !== null) + 1)

const tab = (page: Page, name: string) => page.getByRole('tab', { name })

test('the current word in the middle; a word opens "Слово", "Назад" returns to "План"', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  // Words 1–200 learned: the current word is 201.
  await seedStorage(page, { course: '"kids"', done: JSON.stringify(range(0, 200)) })
  await page.goto('./#/word')
  await tab(page, common.tabs.plan).click()
  await expect(page.locator('.plan .item.cur .n')).toHaveText('201')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect.poll(() => offCenter(page)).toBeLessThanOrEqual(1)
  const curTheme = await currentTheme(page)
  expect(await openThemes(page)).toEqual([curTheme])

  // Theme 3 opened by hand stays open through "Слово" and "Назад"; its first word is pressed.
  const theme3 = page.locator('.plan details').nth(2)
  await theme3.locator('summary').click()
  await expect.poll(() => openThemes(page)).toEqual([3, curTheme])
  const pressed = await theme3.locator('.item .n').first().innerText()

  await theme3.locator('.item').first().click()
  await expect(tab(page, common.tabs.word)).toHaveAttribute('aria-selected', 'true')
  expect(new URL(page.url()).hash).toBe('#/word')
  await expect(page.locator('.card.word')).toContainText(
    fill(word.meta.position, { n: pressed, total: 500 }),
  )

  await page.goBack()
  await expect(tab(page, common.tabs.plan)).toHaveAttribute('aria-selected', 'true')
  expect(new URL(page.url()).hash).toBe('#/plan')
  await expect(page.locator('.plan .item.cur .n')).toHaveText(pressed)
  await expect.poll(() => offCenter(page)).toBeLessThanOrEqual(1)
  expect(await openThemes(page)).toEqual([3, curTheme])
  expect(errors).toEqual([])
})
