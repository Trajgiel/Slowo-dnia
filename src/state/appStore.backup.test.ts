// "Резервная копия прогресса" and "Начать заново" actions of the store (analyst/features/react-port/
// us-7-backup-reset.md; architecture/react-port/storage.md → "Когда что пишется"): copy and share save the
// progress first; restore and reset write the prototype's `writeCourse` keys, read the course again,
// open a new session and reconcile the deck; the other outcomes only set the status.
import { describe, expect, it, vi } from 'vitest'
import { createBackupCode, type CourseId } from '../domain'
import { EXPORT_FIXTURES } from '../domain/backup/backup.fixtures'
import { createRepo } from '../storage'
import { fakeLoader } from '../test/fakeLoader'
import { FakeStorage } from '../test/fakeStorage'
import { seqRng } from '../test/rng'
import { createAppStore } from './appStore'

async function setup(items: Record<string, string>) {
  const ls = new FakeStorage(items)
  const store = createAppStore({
    storage: createRepo(() => ls),
    loadCourse: fakeLoader().load,
    now: () => new Date(2026, 9, 26, 12),
    rng: seqRng(0),
  })
  await store.getState().actions.start()
  return { ls, store, actions: store.getState().actions }
}

const fixture = (name: string) => {
  const found = EXPORT_FIXTURES.find((f) => f.name === name)
  if (!found) throw new Error(name)
  return found
}
const KIDS = fixture('kids, typical progress')
const ADULT = fixture('adult, first, middle and last words')

/** Keys of `writeCourse` for course prefix `p`: decks and results of both directions are `null`. */
const cleared = (p: string, except: readonly string[] = []) =>
  Object.fromEntries(
    ['deck_ru', 'deck_pl', 'last_ru', 'last_pl', 'prev_ru', 'prev_pl']
      .filter((k) => !except.includes(k))
      .map((k) => [p + k, 'null']),
  )

const OTHER_KEYS = {
  theme: '"light"',
  qmode: '"free"',
  kid: '"boy"',
  'adult:done': '[3]',
  'adult:kid': '"boy"',
}

describe('export: "Скопировать код", "Отправить…"', () => {
  it('saves done, weak, days first and gives the code of what was saved', async () => {
    const { ls, store, actions } = await setup({ course: '"kids"', done: '[0]' })
    actions.toggleLearned() // word 1, today
    const code = actions.exportBackupCode()
    expect(ls.snapshot()).toMatchObject({ done: '[0,1]', weak: '{}', days: '["2026-10-26"]' })
    expect(code).toBe(createBackupCode('kids', { done: [0, 1], weak: {}, days: ['2026-10-26'] }))
    // "Отправить…" leaves the field and the status as they were.
    expect(store.getState().session).toMatchObject({ backupCode: '', backupStatus: null })
  })

  it('the code made from stored progress is the prototype string', async () => {
    const { actions } = await setup({
      course: '"kids"',
      done: JSON.stringify(KIDS.done),
      weak: JSON.stringify(KIDS.weak),
      days: JSON.stringify(KIDS.days),
    })
    expect(actions.exportBackupCode()).toBe(KIDS.code)
  })

  it('copy: the code goes into the field, "в поле ниже" until the clipboard answers, then "скопирован"', async () => {
    const { store, actions } = await setup({ course: '"kids"', done: '[0,1,2]' })
    let answer: (ok: boolean) => void = () => undefined
    const copy = vi.fn<(code: string) => Promise<boolean>>(
      () => new Promise<boolean>((resolve) => (answer = resolve)),
    )
    const pending = actions.copyBackupCode(copy)
    const code = copy.mock.calls[0]?.[0]
    expect(code).toMatch(/^SD1\.k\./)
    expect(store.getState().session).toMatchObject({
      backupCode: code,
      backupStatus: { id: 'codeInField' },
    })
    answer(true)
    expect(await pending).toBe(true)
    expect(store.getState().session.backupStatus).toEqual({
      id: 'copied',
      course: 'kids',
      count: 3,
    })
  })

  it('copy without the clipboard: the code stays in the field, "выделен в поле"', async () => {
    const { store, actions } = await setup({ course: '"kids"' })
    expect(await actions.copyBackupCode(() => Promise.resolve(false))).toBe(false)
    expect(store.getState().session.backupCode).toMatch(/^SD1\.k\./)
    expect(store.getState().session.backupStatus).toEqual({ id: 'selectAndCopy' })
  })
})

describe('"Восстановить из кода"', () => {
  it.each([
    ['kids', '', KIDS],
    ['adult', 'adult:', ADULT],
  ] as const)(
    '%s: writes as the prototype writeCourse, reads the course again',
    async (course, p, f) => {
      const { ls, store, actions } = await setup({
        ...OTHER_KEYS,
        course: JSON.stringify(course),
        [p + 'done']: '[1,2]',
        [p + 'weak']: '{"1":5}',
        [p + 'days']: '["2026-01-01"]',
        [p + 'deck_pl']: '{"order":[1,2],"ans":{}}',
        [p + 'last_pl']: '{"right":1,"wrong":1,"total":2,"date":"2026-01-01"}',
        [p + 'prev_pl']: '{"right":2,"wrong":0,"total":2,"date":"2025-12-31"}',
      })
      actions.setQuizMode('deck')
      actions.setBackupCode(f.code)
      actions.restoreBackup()

      // "Сверка колоды" made a new deck of the restored words; its order differs from the prototype.
      const { [p + 'deck_ru']: deck, ...rest } = ls.snapshot()
      const writeCourse = cleared(p, ['deck_ru'])
      expect(rest).toEqual({
        ...OTHER_KEYS,
        course: JSON.stringify(course),
        qmode: '"deck"',
        ...writeCourse,
        [p + 'done']: JSON.stringify(f.done),
        [p + 'weak']: JSON.stringify(f.weak),
        [p + 'days']: JSON.stringify(f.days),
      })
      const order = (JSON.parse(deck ?? 'null') as { order: number[] }).order
      expect([...order].sort((a, b) => a - b)).toEqual(f.done)

      const state = store.getState()
      expect([...state.done]).toEqual(f.done)
      expect(state.weak).toEqual(f.weak)
      expect(state.days).toEqual(f.days)
      expect(state.deckResults.pl).toEqual({ last: null, prev: null })
      expect(state.decks.pl).toBeNull()
      expect(state.gender).toBe('boy')
      expect(state.session).toMatchObject({
        cur: firstGap(f.done),
        answerShown: false,
        backupCode: f.code,
        backupStatus: { id: 'restored', course, count: f.done.length },
      })
    },
  )

  it('a new session: first unlearned word, its theme only open on "План", "Без конца" anew', async () => {
    const { store, actions } = await setup({ course: '"kids"', qmode: '"free"', done: '[0,1]' })
    actions.showWord(40)
    actions.setThemeOpen(3, true)
    actions.showAnswer()
    const code = createBackupCode('kids', { done: [0, 1, 2], weak: {}, days: [] })
    actions.setBackupCode(code)
    actions.restoreBackup()
    const { session, words } = store.getState()
    expect(session.cur).toBe(3)
    expect([...session.openThemes]).toEqual([words[3]?.ti])
    expect(session.answerShown).toBe(false)
    // "Без конца" started anew and picked a question among the restored words.
    expect([0, 1, 2]).toContain(session.free.idx)
    expect(session.free.recent).toEqual([session.free.idx])
  })

  it('spaces and line breaks in the code are ignored', async () => {
    const { store, actions } = await setup({ course: '"kids"' })
    actions.setBackupCode(` ${KIDS.code.slice(0, 20)}\n${KIDS.code.slice(20)}\n `)
    actions.restoreBackup()
    expect([...store.getState().done]).toEqual(KIDS.done)
  })

  it('numbers outside the course are written as the prototype does, but not learned or counted', async () => {
    const { ls, store, actions } = await setup({ course: '"kids"' })
    actions.setBackupCode(
      createBackupCode('kids', { done: [0, 499, 500, 777], weak: {}, days: [] }),
    )
    actions.restoreBackup()
    expect(ls.snapshot().done).toBe('[0,499,500,777]')
    expect([...store.getState().done]).toEqual([0, 499])
    expect(store.getState().session.backupStatus).toEqual({
      id: 'restored',
      course: 'kids',
      count: 2,
    })
  })

  it.each<[string, string, CourseId, object]>([
    ['empty', '', 'kids', { id: 'unreadable' }],
    ['not SD1', 'hello', 'kids', { id: 'unreadable' }],
    ['cut', KIDS.code.slice(0, 30), 'kids', { id: 'unreadable' }],
    ['another course', ADULT.code, 'kids', { id: 'otherCourse', other: 'adult' }],
    ['another course (adult open)', KIDS.code, 'adult', { id: 'otherCourse', other: 'kids' }],
    ['no progress inside', 'SD1.k.bnVsbA', 'kids', { id: 'noProgress', course: 'kids' }],
  ])('%s → status only, nothing is written', async (_name, code, course, status) => {
    const { ls, store, actions } = await setup({
      course: JSON.stringify(course),
      done: '[4]',
      'adult:done': '[4]',
    })
    const before = ls.snapshot()
    const { done, session } = store.getState()
    actions.setBackupCode(code)
    actions.restoreBackup()
    expect(ls.snapshot()).toEqual(before)
    expect(store.getState().done).toBe(done)
    expect(store.getState().session).toMatchObject({
      cur: session.cur,
      backupCode: code,
      backupStatus: status,
    })
  })
})

describe('"Сбросить прогресс"', () => {
  it('empty progress and cleared decks of this course only; status cleared, field kept; toast; word 0', async () => {
    const { ls, store, actions } = await setup({
      ...OTHER_KEYS,
      course: '"kids"',
      done: '[0,1,2]',
      weak: '{"1":2}',
      days: '["2026-10-25"]',
      deck_ru: '{"order":[0,1,2],"ans":{"0":true}}',
      last_ru: '{"right":3,"wrong":0,"total":3,"date":"2026-10-25"}',
    })
    actions.setBackupCode('my code')
    await actions.copyBackupCode(() => Promise.resolve(true))
    actions.setBackupCode('my code')
    actions.resetProgress()
    expect(ls.snapshot()).toEqual({
      ...OTHER_KEYS,
      course: '"kids"',
      ...cleared(''),
      done: '[]',
      weak: '{}',
      days: '[]',
    })
    const state = store.getState()
    expect(state.done.size).toBe(0)
    expect(state.session).toMatchObject({ cur: 0, backupCode: 'my code', backupStatus: null })
    expect(state.toast).toMatchObject({ id: 'progressReset' })
    expect(state.gender).toBe('boy')
    expect(state.theme).toBe('light')
    expect(state.quizMode).toBe('free')
  })
})

describe('course change', () => {
  it('clears the field and the status (they were about the old course)', async () => {
    const { store, actions } = await setup({ course: '"kids"' })
    actions.setBackupCode('x')
    actions.restoreBackup()
    expect(store.getState().session.backupStatus).not.toBeNull()
    await actions.selectCourse('adult')
    expect(store.getState().session).toMatchObject({ backupCode: '', backupStatus: null })
  })
})

/** First number missing from an ascending list starting at 0. */
function firstGap(done: readonly number[]): number {
  let i = 0
  while (done[i] === i) i++
  return i
}
