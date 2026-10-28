// "Настройки" actions of the store (analyst/features/react-port/us-6-settings.md;
// architecture/react-port/storage.md → "Когда что пишется"; architecture/react-port/course-data.md →
// "Ошибка загрузки (П-6)"): theme, gender and course change write exactly the prototype's keys and texts;
// the gender keeps word numbers, progress and the session; a failed course change changes nothing.
import { describe, expect, it, vi } from 'vitest'
import type { Theme } from '../domain'
import { createRepo } from '../storage'
import { fakeLoader, type AdultOutcome } from '../test/fakeLoader'
import { FakeStorage } from '../test/fakeStorage'
import { realCourses } from '../test/realCourses'
import { seqRng } from '../test/rng'
import { createAppStore, type AppStoreDeps } from './appStore'

function setup(
  items: Record<string, string> = {},
  options: { adult?: AdultOutcome[]; real?: boolean } = {},
) {
  const ls = new FakeStorage(items)
  const loader = fakeLoader(options.adult)
  const applyTheme = vi.fn<(theme: Theme) => void>()
  const deps: AppStoreDeps = {
    storage: createRepo(() => ls),
    loadCourse: options.real ? realCourses : loader.load,
    now: () => new Date(2026, 9, 26, 12),
    rng: seqRng(0),
    applyTheme,
  }
  const store = createAppStore(deps)
  return { ls, loader, store, applyTheme, actions: store.getState().actions }
}

describe('"Тема"', () => {
  it('writes theme, puts it on the page, keeps the rest', async () => {
    const { ls, store, applyTheme, actions } = setup({ course: '"kids"' })
    await actions.start()
    actions.setTheme('light')
    expect(store.getState().theme).toBe('light')
    expect(applyTheme).toHaveBeenLastCalledWith('light')
    expect(ls.snapshot()).toEqual({ course: '"kids"', theme: '"light"' })
    actions.setTheme('dark')
    expect(applyTheme).toHaveBeenLastCalledWith('dark')
    expect(ls.snapshot()).toEqual({ course: '"kids"', theme: '"dark"' })
  })
})

describe('"Кто учится"', () => {
  it('kids: writes kid, words take the boy forms, numbers and progress stay', async () => {
    const { ls, store, actions } = setup({ course: '"kids"', done: '[0,1]' }, { real: true })
    await actions.start()
    const girlWords = store.getState().words
    actions.setGender('boy')
    const { words, gender, done, session } = store.getState()
    expect(gender).toBe('boy')
    expect(words).toHaveLength(girlWords.length)
    expect(words.some((w, i) => w.pl !== girlWords[i]?.pl)).toBe(true)
    expect(words.map((w) => w.ti)).toEqual(girlWords.map((w) => w.ti))
    expect([...done]).toEqual([0, 1])
    expect(session.cur).toBe(2)
    expect(ls.snapshot()).toMatchObject({ kid: '"boy"', done: '[0,1]' })
  })

  it('adult: writes adult:kid, the kids key stays', async () => {
    const { ls, actions } = setup({ course: '"adult"', kid: '"girl"' })
    await actions.start()
    actions.setGender('boy')
    expect(ls.snapshot()).toEqual({ course: '"adult"', kid: '"girl"', 'adult:kid': '"boy"' })
  })

  it('keeps the open word, open themes of "План" and the shown answer', async () => {
    const { store, actions } = setup({ course: '"kids"', done: '[0,1,2]' }, { real: true })
    await actions.start()
    actions.showWord(40)
    actions.setThemeOpen(5, true)
    actions.openTab('quiz')
    actions.showAnswer()
    const before = store.getState().session
    actions.setGender('boy')
    const after = store.getState().session
    expect(after.cur).toBe(40)
    expect(after.openThemes).toBe(before.openThemes)
    expect(after.answerShown).toBe(true)
  })

  it('then reconciles the deck (deck mode, learned words, no deck yet)', async () => {
    const { ls, actions } = setup({ course: '"kids"', done: '[1,3]' })
    await actions.start()
    ls.items.delete('deck_ru') // the deck is read from the storage: gone → a new one is written
    actions.setGender('boy')
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[1,3]',
      kid: '"boy"',
      deck_ru: '{"order":[3,1],"ans":{}}',
    })
  })

  it('the same gender again: written again, nothing redrawn', async () => {
    const { ls, store, actions } = setup({ course: '"kids"' })
    await actions.start()
    const words = store.getState().words
    actions.setGender('girl')
    expect(store.getState().words).toBe(words)
    expect(ls.snapshot()).toEqual({ course: '"kids"', kid: '"girl"' })
  })

  it('each course keeps its own gender', async () => {
    const { store, actions } = setup({ course: '"kids"' })
    await actions.start()
    actions.setGender('boy')
    await actions.selectCourse('adult')
    expect(store.getState().gender).toBe('girl')
    await actions.selectCourse('kids')
    expect(store.getState().gender).toBe('boy')
  })
})

describe('course change in "Настройки"', () => {
  it('adult fails → toast, course, progress and session stay, nothing written', async () => {
    const { ls, store, actions } = setup({ course: '"kids"', done: '[0]' }, { adult: ['network'] })
    await actions.start()
    actions.showWord(7)
    actions.setThemeOpen(3, true)
    const before = store.getState()
    const snapshot = ls.snapshot()
    expect(await actions.selectCourse('adult')).toBe(false)
    const after = store.getState()
    expect(after).toMatchObject({
      gate: 'ready',
      course: 'kids',
      toast: { id: 'courseLoadFailed' },
    })
    expect(after.session).toBe(before.session)
    expect(after.done).toBe(before.done)
    expect(after.words).toBe(before.words)
    expect(ls.snapshot()).toEqual(snapshot)
  })

  it('theme, gender and course in turn → the keys and texts the prototype writes', async () => {
    const { ls, actions } = setup({ course: '"kids"', done: '[2,5]', 'adult:done': '[0]' })
    await actions.start()
    actions.setTheme('light')
    actions.setGender('boy')
    await actions.selectCourse('adult')
    actions.setGender('boy')
    actions.setTheme('dark')
    await actions.selectCourse('kids')
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      theme: '"dark"',
      kid: '"boy"',
      done: '[2,5]',
      deck_ru: '{"order":[5,2],"ans":{}}',
      'adult:done': '[0]',
      'adult:kid': '"boy"',
      'adult:deck_ru': '{"order":[0],"ans":{}}',
    })
  })
})
