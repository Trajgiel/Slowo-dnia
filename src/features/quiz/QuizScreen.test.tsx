// "Опрос" screen: what is shown in each state and after each press, on the real kids course
// (analyst/features/react-port/us-3-quiz-deck.md, us-4-quiz-free.md; us-12-details.md → склонения).
// What is written to the storage is the store's test (src/state/appStore.quiz.test.ts).
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import common from '../../i18n/locales/ru/common.json'
import quiz from '../../i18n/locales/ru/quiz.json'
import { realCourses } from '../../test/realCourses'
import { renderApp } from '../../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

/** "Опрос" of the kids course. Words: 0 "Cześć!", 1 "Dzień dobry!" (long Russian), 2 "Do widzenia!". */
function renderQuiz(items: Record<string, string> = {}) {
  return renderApp({
    storage: { course: '"kids"', ...items },
    path: '/quiz',
    loadCourse: realCourses,
  })
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name })
const card = (container: HTMLElement) => container.querySelector<HTMLElement>('.quiz')
const below = (container: HTMLElement) => container.querySelector<HTMLElement>('.quizbelow')
const answer = (container: HTMLElement) => container.querySelector<HTMLElement>('.ans')
const top = (container: HTMLElement) => card(container)?.querySelector('.ask')?.textContent
const score = (container: HTMLElement) => card(container)?.querySelector('.score')

describe('switches and lead', () => {
  it('"Колода" by default: modes and directions pressed, the plate hidden, the deck lead', async () => {
    const { container } = await renderQuiz()
    expect(screen.getByRole('heading', { name: quiz.title })).toBeInTheDocument()
    const modes = within(screen.getByRole('group', { name: quiz.mode.label }))
    expect(modes.getByRole('button', { name: quiz.mode.deck })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(modes.getByRole('button', { name: quiz.mode.free })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const dirs = screen.getByRole('group', { name: quiz.dir.label })
    expect(dirs).not.toHaveAttribute('inert')
    expect(within(dirs).getByRole('button', { name: quiz.dir.ru })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const plate = container.querySelector('.segnote')
    expect(plate).toHaveTextContent(quiz.dir.mixed)
    expect(plate).toHaveClass('inv')
    expect(plate).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.quizlead')).toHaveTextContent(quiz.lead.deck)
  })

  it('"Без конца": the direction switch is hidden in place and inert, the plate shows, the free lead', async () => {
    const { container } = await renderQuiz({ qmode: '"free"' })
    expect(btn(quiz.mode.free)).toHaveAttribute('aria-pressed', 'true')
    const dirs = container.querySelector('.dirwrap > .seg:not(.segnote)')
    expect(dirs).toHaveClass('inv')
    expect(dirs).toHaveAttribute('inert')
    expect(container.querySelector('.segnote')).not.toHaveClass('inv')
    expect(container.querySelector('.segnote')).not.toHaveAttribute('aria-hidden')
    expect(container.querySelector('.quizlead')).toHaveTextContent(quiz.lead.free)
  })

  it('a press on the other mode switches the screen', async () => {
    const { container } = await renderQuiz({ done: '[2]' })
    fireEvent.click(btn(quiz.mode.free))
    expect(btn(quiz.mode.free)).toHaveAttribute('aria-pressed', 'true')
    expect(btn(quiz.free.skip)).toBeInTheDocument()
    fireEvent.click(btn(quiz.mode.deck))
    expect(top(container)).toBe('Карточка 1 из 1')
  })
})

describe('nothing learned', () => {
  it.each([['"deck"'], ['"free"']])(
    'qmode %s → "Пока нечего спрашивать", nothing under it',
    async (qmode) => {
      const { container } = await renderQuiz({ qmode })
      const empty = container.querySelector('.empty')
      expect(empty).toHaveTextContent(quiz.empty.title)
      expect(empty).toHaveTextContent(quiz.empty.text)
      expect(card(container)).toBeNull()
      expect(below(container)).toBeEmptyDOMElement()
    },
  )
})

describe('question card', () => {
  it('Russian → Polish: ask, question, the answer kept in place but hidden, "Показать ответ"', async () => {
    const { container } = await renderQuiz({ done: '[2]' })
    const c = within(card(container) ?? container)
    expect(top(container)).toBe('Карточка 1 из 1')
    expect(c.getByText(quiz.ask.ru)).toBeInTheDocument()
    expect(c.getByText('До свидания!')).not.toHaveAttribute('lang')
    expect(answer(container)).toHaveClass('inv')
    expect(answer(container)).toHaveAttribute('aria-hidden', 'true')
    expect(within(answer(container) ?? container).getByText('Do widzenia!')).toHaveAttribute(
      'lang',
      'pl',
    )
    expect(answer(container)).toHaveTextContent('[до видзэ́ня]')
    expect(answer(container)).toHaveTextContent(common.speak)
    expect(screen.queryByRole('button', { name: common.speak })).toBeNull()
    expect(btn(quiz.showAnswer)).toHaveClass('primary')
    expect(screen.queryByRole('button', { name: quiz.answer.yes })).toBeNull()
  })

  it('"Показать ответ" → the answer is readable; "Не вспомнили" and green "Ответили ✓"', async () => {
    const { container } = await renderQuiz({ done: '[2]' })
    fireEvent.click(btn(quiz.showAnswer))
    expect(answer(container)).not.toHaveClass('inv')
    expect(answer(container)).not.toHaveAttribute('aria-hidden')
    expect(btn(common.speak)).toBeInTheDocument()
    expect(btn(quiz.answer.no)).not.toHaveClass('isdone')
    expect(btn(quiz.answer.yes)).toHaveClass('isdone')
    expect(screen.queryByRole('button', { name: quiz.showAnswer })).toBeNull()
  })

  it('Polish → Russian: the Polish question with "Послушать" under it, the Russian answer', async () => {
    const { container } = await renderQuiz({ done: '[2]', qdir: '"pl"' })
    const c = card(container) ?? container
    expect(within(c).getByText(quiz.ask.pl)).toBeInTheDocument()
    const question = within(c).getByText('Do widzenia!')
    expect(question).toHaveAttribute('lang', 'pl')
    expect(question.nextElementSibling).toHaveTextContent(common.speak)
    expect(btn(common.speak)).toBeInTheDocument()
    expect(answer(container)).toHaveTextContent('До свидания!')
    expect(answer(container)).not.toHaveTextContent(common.speak)
  })

  it('a text longer than 24 characters gets the smaller font; question and answer apart', async () => {
    const ru = await renderQuiz({ done: '[1]' })
    expect(ru.container.querySelector('.q')).toHaveClass('long')
    expect(ru.container.querySelector('.ans .a')).not.toHaveClass('long')
    ru.unmount()
    const pl = await renderQuiz({ done: '[1]', qdir: '"pl"' })
    expect(pl.container.querySelector('.q')).not.toHaveClass('long')
    expect(pl.container.querySelector('.ans .a')).toHaveClass('long')
  })

  it('a mode or direction switch hides a shown answer', async () => {
    const { container } = await renderQuiz({ done: '[2]' })
    fireEvent.click(btn(quiz.showAnswer))
    fireEvent.click(btn(quiz.dir.pl))
    expect(answer(container)).toHaveClass('inv')
    fireEvent.click(btn(quiz.showAnswer))
    fireEvent.click(btn(quiz.mode.free))
    expect(answer(container)).toHaveClass('inv')
  })
})

describe('"Колода"', () => {
  it('card number, green and red score, last result with its date and "Начать колоду заново"', async () => {
    const { container } = await renderQuiz({
      done: '[0,2]',
      deck_ru: '{"order":[0,2],"ans":{"0":false}}',
      last_ru: '{"right":3,"wrong":1,"total":4,"date":"2026-10-20"}',
    })
    expect(top(container)).toBe('Карточка 2 из 2')
    expect(score(container)?.textContent).toBe('Правильно: 0 из 2 · Неправильно: 1')
    expect(score(container)?.querySelector('.okc')).toHaveTextContent('0')
    expect(score(container)?.querySelector('.badc')).toHaveTextContent('1')
    expect(below(container)?.querySelector('.msg')?.textContent).toBe(
      'Прошлый результат: ✓ 3 из 4 · ✗ 1 · 20.10',
    )
    expect(btn(quiz.deck.restart)).toHaveClass('ghost')
  })

  it('no answer yet → no "Начать колоду заново"; no result → nothing under the card', async () => {
    const { container } = await renderQuiz({ done: '[0,2]' })
    expect(below(container)).toBeEmptyDOMElement()
  })

  it('an answer moves to the next card and hides the answer', async () => {
    const { container } = await renderQuiz({ done: '[0,2]', deck_ru: '{"order":[0,2],"ans":{}}' })
    fireEvent.click(btn(quiz.showAnswer))
    fireEvent.click(btn(quiz.answer.yes))
    expect(top(container)).toBe('Карточка 2 из 2')
    expect(score(container)?.textContent).toBe('Правильно: 1 из 2 · Неправильно: 0')
    expect(within(card(container) ?? container).getByText('До свидания!')).toBeInTheDocument()
    expect(answer(container)).toHaveClass('inv')
  })

  it('"Начать колоду заново" asks first, the second press starts a new deck', async () => {
    const { container } = await renderQuiz({
      done: '[0,2]',
      deck_ru: '{"order":[0,2],"ans":{"0":true}}',
    })
    fireEvent.click(btn(quiz.deck.restart))
    expect(top(container)).toBe('Карточка 2 из 2')
    fireEvent.click(btn(quiz.deck.restartConfirm))
    expect(top(container)).toBe('Карточка 1 из 2')
    expect(screen.queryByRole('button', { name: quiz.deck.restart })).toBeNull()
  })

  it('a result without a date → the line without it', async () => {
    const { container } = await renderQuiz({
      done: '[0]',
      last_ru: '{"right":1,"wrong":1,"total":2,"date":""}',
    })
    expect(below(container)?.textContent).toBe('Прошлый результат: ✓ 1 из 2 · ✗ 1')
  })
})

describe('solved deck', () => {
  const solved = (ans: string, extra: Record<string, string> = {}) =>
    renderQuiz({ done: '[0,1,2]', deck_ru: `{"order":[0,1,2],"ans":${ans}}`, ...extra })

  it('100%: direction, 🏆, tiles, "Без единой ошибки!", "Решить заново", an empty line kept', async () => {
    const { container } = await solved('{"0":true,"1":true,"2":true}')
    expect(card(container)).toHaveClass('result')
    expect(top(container)).toBe(quiz.dir.ru)
    expect(
      within(card(container) ?? container).getByText(quiz.deck.solvedPerfect),
    ).toBeInTheDocument()
    const tiles = [...container.querySelectorAll('.rstats .stat')].map((s) => s.textContent)
    expect(tiles).toEqual([
      `3${quiz.deck.tile.right}`,
      `0${quiz.deck.tile.wrong}`,
      `3${quiz.deck.tile.total}`,
    ])
    expect(card(container)).toHaveTextContent(quiz.deck.result.perfect)
    expect(btn(quiz.deck.again)).toHaveClass('primary')
    expect(score(container)?.textContent).toBe(' ')
  })

  it.each([
    ['67% → repeat', '{"0":true,"1":true,"2":false}', '67%. Повторите слова ещё раз.'],
    ['33% → repeat', '{"0":true,"1":false,"2":false}', '33%. Повторите слова ещё раз.'],
  ])('%s, 🎉', async (_, ans, text) => {
    const { container } = await solved(ans)
    expect(within(card(container) ?? container).getByText(quiz.deck.solved)).toBeInTheDocument()
    expect(card(container)).toHaveTextContent(text)
  })

  it('80% → great', async () => {
    const { container } = await renderQuiz({
      done: '[0,1,2,3,4]',
      deck_pl: '{"order":[0,1,2,3,4],"ans":{"0":true,"1":true,"2":true,"3":true,"4":false}}',
      qdir: '"pl"',
    })
    expect(top(container)).toBe(quiz.dir.pl)
    expect(card(container)).toHaveTextContent('80%. Отличный результат!')
  })

  it('more words learned than in the deck → the size of the next deck; previous result under it', async () => {
    const { container } = await renderQuiz({
      done: '[0,1,2,3]',
      deck_ru: '{"order":[0,1],"ans":{"0":true,"1":true}}',
      last_ru: '{"right":2,"wrong":0,"total":2,"date":"2026-10-26"}',
      prev_ru: '{"right":1,"wrong":1,"total":2,"date":"2026-10-19"}',
    })
    expect(score(container)?.textContent).toBe('В новой колоде будет 4 слова')
    expect(below(container)?.textContent).toBe('Прошлый результат: ✓ 1 из 2 · ✗ 1 · 19.10')
  })

  // A solved deck of one word unmarked since: it stays in the score, the next deck has `n` words.
  it.each([
    [2, 'слова'],
    [5, 'слов'],
    [21, 'слово'],
  ])('next deck of %i → "%s"', async (n, noun) => {
    const { container } = await renderQuiz({
      done: JSON.stringify(range(0, n)),
      deck_ru: '{"order":[499],"ans":{"499":true}}',
    })
    expect(score(container)?.textContent).toBe(`В новой колоде будет ${String(n)} ${noun}`)
  })

  it('"Решить заново" → a new deck of all learned words', async () => {
    const { container } = await solved('{"0":true,"1":true,"2":true}')
    fireEvent.click(btn(quiz.deck.again))
    expect(top(container)).toBe('Карточка 1 из 3')
  })
})

describe('"Без конца"', () => {
  it('direction on top, "Выучено n слова" at the bottom, "Другое слово" asks another word', async () => {
    const { container } = await renderQuiz({ qmode: '"free"', done: '[0,2]' })
    expect(top(container)).toBe(quiz.dir.ru)
    expect(within(card(container) ?? container).getByText('Привет!')).toBeInTheDocument()
    expect(score(container)?.textContent).toBe('Выучено 2 слова')
    fireEvent.click(btn(quiz.showAnswer))
    fireEvent.click(btn(quiz.free.skip))
    expect(within(card(container) ?? container).getByText('До свидания!')).toBeInTheDocument()
    expect(answer(container)).toHaveClass('inv')
  })

  it('an answer gives the next question at once', async () => {
    const { container } = await renderQuiz({ qmode: '"free"', done: '[0,2]' })
    fireEvent.click(btn(quiz.showAnswer))
    fireEvent.click(btn(quiz.answer.no))
    expect(within(card(container) ?? container).getByText('До свидания!')).toBeInTheDocument()
    expect(btn(quiz.showAnswer)).toBeInTheDocument()
  })

  it.each([
    [1, 'слово'],
    [5, 'слов'],
    [11, 'слов'],
    [21, 'слово'],
  ])('%i learned → "%s"', async (n, noun) => {
    const { container } = await renderQuiz({ qmode: '"free"', done: JSON.stringify(range(0, n)) })
    expect(score(container)?.textContent).toBe(`Выучено ${String(n)} ${noun}`)
  })

  it('no word can be picked (all weigh nothing) → an empty card keeps its place, "Другое слово" stays', async () => {
    const { container } = await renderQuiz({ qmode: '"free"', done: '[0]', weak: '{"0":-1}' })
    expect(card(container)).toBeEmptyDOMElement()
    expect(btn(quiz.free.skip)).toBeInTheDocument()
  })
})

describe('speech in the quiz', () => {
  const message = (container: HTMLElement) =>
    [...container.querySelectorAll('section > .msg')].map((m) => m.textContent)

  it('"Послушать" → the message under the quiz; the next press hides it', async () => {
    const { container } = await renderQuiz({ done: '[2]', qdir: '"pl"' })
    fireEvent.click(btn(common.speak))
    expect(message(container)).toEqual([common.speech.unsupported])
    fireEvent.click(btn(quiz.showAnswer))
    expect(message(container)).toEqual([])
  })
})
