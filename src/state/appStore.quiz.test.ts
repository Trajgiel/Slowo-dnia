// Quiz actions of the store (analyst/features/react-port/us-3-quiz-deck.md, us-4-quiz-free.md): what the
// store shows next and the exact text of every key after each sequence. The expected texts are what the
// prototype writes after the same presses (materials/project/index.html: `renderDeck` `answer`, `markWeak`
// → `save()`, the mode and direction buttons, `qAgain` / `qRestart`, `renderFree` / `nextFree`;
// architecture/react-port/storage.md → "Когда что пишется"); only the deck order depends on the rng.
import { describe, expect, it } from 'vitest'
import type { Rng } from '../domain'
import { createRepo } from '../storage'
import { fakeLoader } from '../test/fakeLoader'
import { FakeStorage } from '../test/fakeStorage'
import { seqRng } from '../test/rng'
import { createAppStore } from './appStore'

function setup(items: Record<string, string>, rng: Rng = seqRng(0)) {
  const ls = new FakeStorage(items)
  const store = createAppStore({
    storage: createRepo(() => ls),
    loadCourse: fakeLoader().load,
    now: () => new Date(2026, 9, 26, 12),
    rng,
  })
  return { ls, store, actions: store.getState().actions }
}

/** Rng returning `value` that counts its calls. */
function countingRng(value = 0) {
  const rng = Object.assign(
    () => {
      rng.calls++
      return value
    },
    { calls: 0 },
  )
  return rng
}

describe('quiz mode and direction', () => {
  it('direction: writes qdir, hides the answer, reconciles the deck of that direction', async () => {
    const { ls, store, actions } = setup({ course: '"kids"', done: '[1,3]' })
    await actions.start()
    actions.showAnswer()
    expect(store.getState().session.answerShown).toBe(true)
    actions.setQuizDir('pl')
    expect(store.getState()).toMatchObject({ quizDir: 'pl', session: { answerShown: false } })
    expect(store.getState().decks.pl).toEqual({ order: [3, 1], ans: {} })
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[1,3]',
      deck_ru: '{"order":[3,1],"ans":{}}',
      qdir: '"pl"',
      deck_pl: '{"order":[3,1],"ans":{}}',
    })
  })

  it('mode: writes qmode; "Без конца" picks a question and leaves the decks alone', async () => {
    const { ls, store, actions } = setup({ course: '"kids"', done: '[1,3]' })
    await actions.start()
    const before = ls.snapshot()
    actions.showAnswer()
    actions.setQuizMode('free')
    expect(store.getState()).toMatchObject({
      quizMode: 'free',
      session: { answerShown: false, free: { idx: 1, dir: 'ru', recent: [1] } },
    })
    expect(ls.snapshot()).toEqual({ ...before, qmode: '"free"' })
    actions.setQuizMode('deck')
    expect(ls.snapshot()).toEqual({ ...before, qmode: '"deck"' })
  })

  it('nothing learned: switching writes only the setting', async () => {
    const { ls, store, actions } = setup({ course: '"kids"' })
    await actions.start()
    actions.setQuizMode('free')
    actions.setQuizDir('pl')
    expect(store.getState().session.free.idx).toBeNull()
    expect(ls.snapshot()).toEqual({ course: '"kids"', qmode: '"free"', qdir: '"pl"' })
  })
})

describe('"Колода": answers', () => {
  it('each answer saves done, weak, days and the deck; the last one moves last to prev', async () => {
    const lastBefore = '{"right":1,"wrong":0,"total":1,"date":"2026-10-20"}'
    const { ls, store, actions } = setup({
      course: '"kids"',
      done: '[1,3]',
      weak: '{"3":1}',
      days: '["2026-10-25"]',
      deck_ru: '{"order":[3,1],"ans":{}}',
      last_ru: lastBefore,
    })
    await actions.start()

    actions.showAnswer()
    actions.answerQuiz(true)
    expect(store.getState().session.answerShown).toBe(false)
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[1,3]',
      weak: '{}',
      days: '["2026-10-25"]',
      deck_ru: '{"order":[3,1],"ans":{"3":true}}',
      last_ru: lastBefore,
    })

    actions.answerQuiz(false)
    const solved = {
      course: '"kids"',
      done: '[1,3]',
      weak: '{"1":1}',
      days: '["2026-10-25"]',
      // Integer keys come out ascending in JSON, in the prototype too.
      deck_ru: '{"order":[3,1],"ans":{"1":false,"3":true}}',
      last_ru: '{"right":1,"wrong":1,"total":2,"date":"2026-10-26"}',
      prev_ru: lastBefore,
    }
    expect(ls.snapshot()).toEqual(solved)
    expect(store.getState().deckResults.ru).toEqual({
      last: { right: 1, wrong: 1, total: 2, date: '2026-10-26' },
      prev: { right: 1, wrong: 0, total: 1, date: '2026-10-20' },
    })

    // A solved deck takes no more answers.
    actions.answerQuiz(true)
    expect(ls.snapshot()).toEqual(solved)
  })

  it('first solved deck: no previous result is written; "Не вспомнили" has no upper cap', async () => {
    const { ls, actions } = setup({
      course: '"kids"',
      done: '[4]',
      weak: '{"4":7}',
      deck_pl: '{"order":[4],"ans":{}}',
      qdir: '"pl"',
    })
    await actions.start()
    actions.answerQuiz(false)
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[4]',
      weak: '{"4":8}',
      days: '[]',
      deck_pl: '{"order":[4],"ans":{"4":false}}',
      qdir: '"pl"',
      last_pl: '{"right":0,"wrong":1,"total":1,"date":"2026-10-26"}',
    })
  })

  it('a word unmarked before its answer drops out; the answered one stays in the score', async () => {
    const { ls, store, actions } = setup({
      course: '"kids"',
      done: '[0,1,2]',
      deck_ru: '{"order":[0,1,2],"ans":{"0":true}}',
    })
    await actions.start()
    actions.showWord(1)
    actions.toggleLearned()
    actions.showWord(0)
    actions.toggleLearned()
    actions.openTab('quiz')
    actions.answerQuiz(true)
    expect(store.getState().deckResults.ru.last).toEqual({
      right: 2,
      wrong: 0,
      total: 2,
      date: '2026-10-26',
    })
    expect(ls.snapshot().deck_ru).toBe('{"order":[0,1,2],"ans":{"0":true,"2":true}}')
  })

  it('restart: a new deck of all learned words; results stay; the answer is hidden', async () => {
    const { ls, store, actions } = setup({
      course: '"kids"',
      done: '[1,3,5]',
      deck_ru: '{"order":[5,1],"ans":{"5":true,"1":true}}',
      last_ru: '{"right":2,"wrong":0,"total":2,"date":"2026-10-20"}',
    })
    await actions.start()
    const before = ls.snapshot()
    actions.showAnswer()
    actions.restartDeck()
    expect(store.getState().session.answerShown).toBe(false)
    expect(store.getState().decks.ru).toEqual({ order: [3, 5, 1], ans: {} })
    expect(ls.snapshot()).toEqual({ ...before, deck_ru: '{"order":[3,5,1],"ans":{}}' })
  })
})

describe('"Без конца"', () => {
  it('an answer writes only done, weak and days and gives the next question; "Другое слово" writes nothing', async () => {
    // rng 0.9: the last word of the bag, Polish → Russian.
    const { ls, store, actions } = setup(
      { course: '"kids"', done: '[2,6]', days: '["2026-10-25"]', qmode: '"free"' },
      seqRng(0.9),
    )
    await actions.start()
    expect(store.getState().session.free).toEqual({ idx: 6, dir: 'pl', recent: [6] })
    const before = ls.snapshot()

    actions.showAnswer()
    actions.answerQuiz(false)
    expect(ls.snapshot()).toEqual({
      ...before,
      done: '[2,6]',
      weak: '{"6":1}',
      days: '["2026-10-25"]',
    })
    // Recent words: min(10, floor(2 / 2)) = 1, so 6 is not asked again while 2 is left.
    expect(store.getState().session).toMatchObject({
      answerShown: false,
      free: { idx: 2, dir: 'pl', recent: [2] },
    })

    const afterAnswer = ls.snapshot()
    actions.showAnswer()
    actions.skipFree()
    expect(ls.snapshot()).toEqual(afterAnswer)
    expect(store.getState().session).toMatchObject({ answerShown: false, free: { idx: 6 } })
  })

  it('the current word unmarked on "Слово" → back in the quiz another word is asked', async () => {
    const { store, actions } = setup({ course: '"kids"', done: '[0,1]', qmode: '"free"' })
    await actions.start()
    expect(store.getState().session.free.idx).toBe(0)
    actions.showWord(0)
    actions.toggleLearned()
    actions.openTab('quiz')
    expect(store.getState().session.free.idx).toBe(1)
  })

  it('every learned word weighs nothing (weak <= -0.5) → no question, one pick per call, no loop', async () => {
    const rng = countingRng()
    const { store, actions } = setup(
      { course: '"kids"', done: '[1,3]', weak: '{"1":-1,"3":-2}', qmode: '"free"' },
      rng,
    )
    await actions.start()
    expect(store.getState().session.free.idx).toBeNull()
    expect(rng.calls).toBe(2)
    actions.openTab('quiz')
    expect(rng.calls).toBe(4)
    actions.skipFree()
    expect(rng.calls).toBe(6)
    actions.answerQuiz(true)
    expect(rng.calls).toBe(6)
    expect(store.getState().session.free.idx).toBeNull()
  })

  it('a course switch starts the mode again', async () => {
    const { store, actions } = setup({
      course: '"kids"',
      done: '[0,1]',
      'adult:done': '[5]',
      qmode: '"free"',
    })
    await actions.start()
    actions.skipFree()
    expect(store.getState().session.free.recent).toEqual([1])
    await actions.selectCourse('adult')
    expect(store.getState().session.free).toEqual({ idx: 5, dir: 'ru', recent: [] })
  })
})
