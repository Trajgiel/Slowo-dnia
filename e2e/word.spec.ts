// End-to-end, SD-13 ("Слово"), on the production build in a real browser
// (analyst/features/react-port/us-2-word.md in the workspace):
// - "Выучили" → real localStorage in the prototype format; after a reload the progress and the streak
//   are read back and the first unlearned word opens ("Навигация и отметка", "Серия дней"; one path);
// - "Вернуться к новому слову" hidden keeps its place: nothing below it moves when it appears;
// - width 320: the theme dots up to "1000" fit, each number inside its dot, no horizontal scroll;
// - "Послушать" on the real Web Speech API of Chromium: a real utterance, pl-PL, rate 0.8, the current
//   speech is stopped first; with no Polish voice the message is shown and another word hides it.
// Not here (developer, jsdom): badge states, arrows on the edges, unmarking, the 400 days, percent,
// dot classes and presses, streak wording, plural forms and the local day, praise toasts and 3.5 s, text preparation
// for speech, the "unsupported" message -> src/features/word/WordScreen.test.tsx,
// src/state/appStore.test.ts, src/platform/speech.test.ts, src/shared/ui/Toast.test.tsx; the course
// chip -> src/app/TabsLayout.test.tsx; the local day in other time zones ->
// src/domain/prototype-parity.acceptance.test.ts. The sound itself on devices -> owner's check on phones.
import { expect, test, type Locator, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import word from '../src/i18n/locales/ru/word.json' with { type: 'json' }
import { collectPageErrors, readStorage, seedStorage } from './support'

/** `{{name}}` placeholders of a dictionary string. */
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key]))

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

const card = (page: Page) => page.locator('.card.word')
const progress = (page: Page) => page.locator('.card.prog')
const learnedButton = (page: Page) => page.getByRole('button', { name: /Выучили$/ })
const toNew = (page: Page) => page.locator('button', { hasText: word.toNew })
const statValues = (page: Page) => progress(page).locator('.stat b')

async function box(selector: Locator) {
  const b = await selector.boundingBox()
  if (!b) throw new Error('element is not rendered')
  return b
}

test('"Выучили" writes the progress to the real storage; after a reload it is read back', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12))
  await seedStorage(page, { course: '"kids"', done: '[0,1]', days: '["2026-10-25"]' })
  await page.goto('./#/word')
  await expect(card(page)).toContainText(fill(word.meta.position, { n: 3, total: 500 }))

  await learnedButton(page).click()
  await expect(learnedButton(page)).toHaveText(word.learned.marked)
  await expect(card(page)).toContainText(fill(word.meta.position, { n: 3, total: 500 }))
  expect(await readStorage(page)).toMatchObject({
    done: '[0,1,2]',
    weak: '{}',
    days: '["2026-10-25","2026-10-26"]',
  })

  await page.reload()
  await expect(card(page)).toContainText(fill(word.meta.position, { n: 4, total: 500 }))
  await expect(card(page)).toContainText(word.badge.new)
  await expect(statValues(page)).toHaveText(['3', '497', '1%'])
  await expect(page.locator('.streak')).toHaveText(fill(word.streak.days_few, { count: 2 }))
  expect(errors).toEqual([])
})

test('"Вернуться к новому слову": hidden, it keeps its place; nothing below moves when it appears', async ({
  page,
}) => {
  await seedStorage(page, { course: '"kids"' })
  await page.goto('./#/word')
  await expect(card(page)).toContainText(word.badge.new)
  await expect(toNew(page)).toBeHidden()
  const hiddenBox = await box(toNew(page))
  // Only the top: the card itself grows by the streak line that the first mark brings.
  const progressTop = (await box(progress(page))).y

  // Same word: marking it moves "the next new word" on, so the button appears under the same card.
  await learnedButton(page).click()
  await expect(toNew(page)).toBeVisible()
  expect(await box(toNew(page))).toEqual(hiddenBox)
  expect((await box(progress(page))).y).toBe(progressTop)

  await toNew(page).click()
  await expect(card(page)).toContainText(fill(word.meta.position, { n: 2, total: 500 }))
  await expect(toNew(page)).toBeHidden()
  expect(await box(toNew(page))).toEqual(hiddenBox)
})

test.describe('width 320', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('the theme dots up to "1000" fit: each number inside its dot, no horizontal scroll', async ({
    page,
  }) => {
    await seedStorage(page, {
      course: '"adult"',
      'adult:done': JSON.stringify(range(0, 1000)),
    })
    await page.goto('./#/word')
    await expect(card(page)).toContainText(fill(word.meta.position, { n: 1000, total: 1000 }))
    const dots = progress(page).locator('.weekdots button')
    await expect(dots).toHaveText(range(991, 1001).map(String))

    const layout = await progress(page).evaluate((prog) => {
      const area = prog.getBoundingClientRect()
      const dotBoxes = [...prog.querySelectorAll<HTMLElement>('.weekdots button')].map((dot) => {
        const r = dot.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          overflow: dot.scrollWidth - dot.clientWidth,
        }
      })
      return {
        area: { left: area.left, right: area.right },
        dotBoxes,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    expect(layout.pageOverflow).toBeLessThanOrEqual(0)
    const first = layout.dotBoxes[0]
    for (const [i, dot] of layout.dotBoxes.entries()) {
      expect.soft(dot.overflow, `dot ${String(991 + i)}: number wider than the dot`).toBe(0)
      expect.soft(dot.top, `dot ${String(991 + i)}: one row`).toBe(first?.top)
      expect.soft(dot.left).toBeGreaterThanOrEqual(layout.area.left)
      expect.soft(dot.right).toBeLessThanOrEqual(layout.area.right)
      const prev = layout.dotBoxes[i - 1]
      if (prev) expect.soft(dot.left, 'dots do not overlap').toBeGreaterThanOrEqual(prev.right)
    }
  })
})

test('"Послушать" on the real speech API: pl-PL at 0.8 after stopping the current speech; no Polish voice → message until another word', async ({
  page,
}) => {
  // The real Chromium speechSynthesis, with the voice list emptied and speak() recorded instead of
  // playing sound.
  await page.addInitScript(() => {
    const calls: unknown[] = []
    Object.assign(window, { __speech: calls })
    const synth = window.speechSynthesis
    synth.getVoices = () => []
    synth.cancel = () => {
      calls.push('cancel')
    }
    synth.speak = (u: SpeechSynthesisUtterance) => {
      calls.push({
        real: u instanceof SpeechSynthesisUtterance,
        text: u.text,
        lang: u.lang,
        // `rate` is a float on the utterance: 0.8 reads back as 0.800000011920929.
        rate: Math.round(u.rate * 100) / 100,
      })
    }
  })
  await seedStorage(page, { course: '"kids"' })
  await page.goto('./#/word')
  const speechCalls = () =>
    page.evaluate(() => (window as unknown as { __speech: unknown[] }).__speech)
  const message = page.locator('section > .msg')

  await page.getByRole('button', { name: common.speak }).click()
  await expect(message).toHaveText(common.speech.noVoice)
  expect(await speechCalls()).toEqual([
    'cancel',
    { real: true, text: 'Cześć!', lang: 'pl-PL', rate: 0.8 },
  ])
  await expect(card(page).locator('[lang="pl"]')).toHaveText('Cześć!')

  await page.getByRole('button', { name: word.next }).click()
  await expect(card(page)).toContainText(fill(word.meta.position, { n: 2, total: 500 }))
  await expect(message).toHaveCount(0)
})
