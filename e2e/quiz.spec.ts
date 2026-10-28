// End-to-end, SD-14 ("Опрос", "Колода"), on the production build in a real browser
// (analyst/features/react-port/us-3-quiz-deck.md, us-12-details.md in the workspace). One deck walked
// through by presses, with a reload in the middle:
// - the card keeps one height (at least 470 px) and its place: before and after "Показать ответ", on
//   another direction and in "Без конца", on the solved deck; at 320 px the mode switch moves nothing
//   (the lead keeps its height);
// - a shown answer stays shown after another tab and back;
// - each answer is saved at once: after a reload the same card and the same score;
// - the last answer: the old "last" result becomes "prev" (shown under the solved deck with its date),
//   the new one is {right, wrong, total, today}; `weak` follows the answers.
// Not here (developer, jsdom): what each state shows and the texts -> src/features/quiz/QuizScreen.test.tsx;
// the keys after each action -> src/state/appStore.quiz.test.ts; the deck rules (new words, unmarked
// words, percent) -> src/domain/deck.test.ts; "Без конца" choice -> src/domain/freeQuiz.test.ts;
// unknown stored mode and direction -> src/features/quiz/quiz-settings.acceptance.test.tsx.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import quiz from '../src/i18n/locales/ru/quiz.json' with { type: 'json' }
import { collectPageErrors, fill, readStorage, seedStorage } from './support'

const LAST = { right: 1, wrong: 1, total: 2, date: '2026-10-20' }

const card = (page: Page) => page.locator('.card.quiz')
const below = (page: Page) => page.locator('.quizbelow')
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const tab = (page: Page, name: string) => page.getByRole('tab', { name })

/** Top and height of the card on the page (not the viewport: a press may scroll). */
const cardBox = (page: Page) =>
  card(page).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top + window.scrollY, height: r.height }
  })

const score = (right: number, wrong: number, total: number) =>
  fill(quiz.deck.score, { right, wrong, total }).replace(/<\/?(ok|bad)>/g, '')

async function expectCard(page: Page, n: number, right: number, wrong: number): Promise<void> {
  await expect(card(page).locator('.ask').first()).toHaveText(fill(quiz.deck.card, { n, total: 3 }))
  await expect(card(page).locator('.score')).toHaveText(score(right, wrong, 3))
}

test('"Колода": answers are saved at once, the card keeps its height, the last answer moves the results', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12))
  await seedStorage(page, {
    course: '"kids"',
    done: '[0,1,2]',
    last_ru: JSON.stringify(LAST),
  })
  await page.goto('./#/quiz')
  await expectCard(page, 1, 0, 0)
  await expect(below(page)).toHaveText(fill(quiz.deck.last, { ...LAST, date: '20.10' }))
  await expect(button(page, quiz.deck.restart)).toHaveCount(0)
  const start = await cardBox(page)
  expect(start.height).toBeGreaterThanOrEqual(470)

  await button(page, quiz.showAnswer).click()
  await expect(card(page).locator('.ans')).toBeVisible()
  expect(await cardBox(page)).toEqual(start)
  await button(page, quiz.answer.yes).click()
  await expectCard(page, 2, 1, 0)
  await expect(button(page, quiz.deck.restart)).toBeVisible()

  // A shown answer survives another tab.
  await button(page, quiz.showAnswer).click()
  await tab(page, common.tabs.word).click()
  await tab(page, common.tabs.quiz).click()
  await expect(button(page, quiz.answer.no)).toBeVisible()
  await expect(card(page).locator('.ans')).toBeVisible()
  await button(page, quiz.answer.no).click()
  await expectCard(page, 3, 1, 1)

  await page.reload()
  await expectCard(page, 3, 1, 1)
  expect(await cardBox(page)).toEqual(start)

  // Another direction has its own deck; "Без конца" has the same card size and place.
  await button(page, quiz.dir.pl).click()
  await expectCard(page, 1, 0, 0)
  expect(await cardBox(page)).toEqual(start)
  await button(page, quiz.mode.free).click()
  await expect(button(page, quiz.free.skip)).toBeVisible()
  expect(await cardBox(page)).toEqual(start)
  await button(page, quiz.mode.deck).click()
  await button(page, quiz.dir.ru).click()
  await expectCard(page, 3, 1, 1)

  await button(page, quiz.showAnswer).click()
  await button(page, quiz.answer.yes).click()
  await expect(card(page)).toContainText(quiz.deck.solved)
  await expect(card(page)).toContainText(fill(quiz.deck.result.retry, { pct: 67 }))
  expect(await cardBox(page)).toEqual(start)
  await expect(below(page)).toHaveText(fill(quiz.deck.last, { ...LAST, date: '20.10' }))

  const stored = await readStorage(page)
  expect(JSON.parse(stored.last_ru ?? 'null')).toEqual({
    right: 2,
    wrong: 1,
    total: 3,
    date: '2026-10-26',
  })
  expect(JSON.parse(stored.prev_ru ?? 'null')).toEqual(LAST)
  const weak = JSON.parse(stored.weak ?? 'null') as Record<string, number>
  expect(Object.values(weak)).toEqual([1])
  expect(errors).toEqual([])
})

test.describe('width 320', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('the mode switch moves nothing: the card keeps its place and height', async ({ page }) => {
    await seedStorage(page, { course: '"kids"', done: '[0]' })
    await page.goto('./#/quiz')
    await expect(card(page).locator('.ask').first()).toHaveText(
      fill(quiz.deck.card, { n: 1, total: 1 }),
    )
    const deck = await cardBox(page)

    await button(page, quiz.mode.free).click()
    await expect(page.locator('.quizlead')).toHaveText(quiz.lead.free)
    expect(await cardBox(page)).toEqual(deck)
    await button(page, quiz.mode.deck).click()
    await expect(page.locator('.quizlead')).toHaveText(quiz.lead.deck)
    expect(await cardBox(page)).toEqual(deck)
  })
})
