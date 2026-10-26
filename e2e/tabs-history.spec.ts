// End-to-end, SD-12 (tabs and addresses), on the production build with the real hash router and the
// real browser history (analyst/features/react-port/us-1-start.md → "Вкладки и адрес" in the workspace):
// - "Назад" after the course choice does not open the choice screen; "Вперёд" returns to "Слово";
// - "Назад" / "Вперёд" between tabs switch the tab and its address, write `tab` each time and scroll
//   the page to the top (the browser restores no scroll); a reopened address opens the same tab;
// - "Назад" on the first tab of the session leaves the page, without an error;
// - old prototype addresses `#quiz`, `index.html#settings` open that tab as `#/<tab>`, adding no
//   history step.
// Not here (developer, memory router): the tab bar itself, a press opens a tab and scrolls,
// a press on the open tab replaces the entry, "План" is not scrolled, every tab address and unknown
// addresses -> src/app/TabsLayout.test.tsx; the choice writes `course` and `tab`, replaces the
// address -> src/features/start/StartScreen.test.tsx; the table of old addresses ->
// src/app/routing/legacyAddress.test.ts; which screen opens for which storage -> src/state/appStore.test.ts.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import start from '../src/i18n/locales/ru/start.json' with { type: 'json' }
import { collectPageErrors, seedStorage } from './support'

type TabName = keyof Omit<typeof common.tabs, 'label'>

const KIDS = { course: '"kids"' }

const tab = (page: Page, name: TabName) => page.getByRole('tab', { name: common.tabs[name] })

async function expectTab(page: Page, name: TabName): Promise<void> {
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1)
  expect(new URL(page.url()).hash).toBe(`#/${name}`)
}

const storedTab = (page: Page) => page.evaluate(() => localStorage.getItem('tab'))
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

/** The tab screens are placeholders: make the page tall enough to scroll. */
async function scrollDown(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.style.minHeight = '5000px'
    window.scrollTo(0, 1200)
  })
  await expect.poll(() => scrollY(page)).toBe(1200)
}

test('"Назад" after the course choice does not open the choice screen', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('./')
  await page.getByRole('button', { name: start.kids.title }).click()
  await expectTab(page, 'word')

  await page.goBack()
  expect(page.url()).toBe('about:blank')

  await page.goForward()
  await expectTab(page, 'word')
  await expect(page.getByText(start.lead)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('"Назад" and "Вперёд" go through the tabs, write tab and scroll to the top; the first tab leaves', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await seedStorage(page, KIDS)
  await page.goto('./#/word')
  await expectTab(page, 'word')
  await tab(page, 'quiz').click()
  await expectTab(page, 'quiz')
  await tab(page, 'settings').click()
  await expectTab(page, 'settings')

  await scrollDown(page)
  await page.goBack()
  await expectTab(page, 'quiz')
  expect(await storedTab(page)).toBe('"quiz"')
  await expect.poll(() => scrollY(page)).toBe(0)

  await scrollDown(page)
  await page.goForward()
  await expectTab(page, 'settings')
  expect(await storedTab(page)).toBe('"settings"')
  await expect.poll(() => scrollY(page)).toBe(0)

  // The copied address, opened again, opens the same tab.
  await page.reload()
  await expectTab(page, 'settings')

  await page.goBack()
  await expectTab(page, 'quiz')
  await page.goBack()
  await expectTab(page, 'word')
  expect(await storedTab(page)).toBe('"word"')

  await page.goBack()
  expect(page.url()).toBe('about:blank')
  expect(errors).toEqual([])
})

for (const [address, name, opened] of [
  ['./#quiz', 'quiz', '/Slowo-dnia/#/quiz'],
  ['./index.html#settings', 'settings', '/Slowo-dnia/index.html#/settings'],
] as const) {
  test(`old address ${address.slice(2)} opens "${common.tabs[name]}" without a history step`, async ({
    page,
  }) => {
    await seedStorage(page, KIDS)
    await page.goto(address)
    await expectTab(page, name)
    const url = new URL(page.url())
    expect(url.pathname + url.hash).toBe(opened)

    await page.goBack()
    expect(page.url()).toBe('about:blank')
  })
}
