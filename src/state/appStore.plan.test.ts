// Open themes of "План" in the store's session (analyst/features/react-port/us-5-plan-help.md → "План";
// architecture/react-port/modules.md → "Состояние (state)"): only the current word's theme is open after
// start-up and a course change; manual opening and closing stay through words, marks and tabs; nothing
// is written to the storage.
import { describe, expect, it } from 'vitest'
import { createRepo } from '../storage'
import { FakeStorage } from '../test/fakeStorage'
import { realCourses } from '../test/realCourses'
import { seqRng } from '../test/rng'
import { createAppStore } from './appStore'

function setup(items: Record<string, string>) {
  const ls = new FakeStorage(items)
  const store = createAppStore({
    storage: createRepo(() => ls),
    loadCourse: realCourses,
    now: () => new Date(2026, 9, 26, 12),
    rng: seqRng(0),
  })
  const open = () => [...store.getState().session.openThemes].sort((a, b) => a - b)
  const themeOf = (i: number) => store.getState().words[i]?.ti
  return { ls, store, actions: store.getState().actions, open, themeOf }
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

describe('"План": open themes', () => {
  it('start-up → only the theme of the current word (the first unlearned) is open', async () => {
    const { actions, open, themeOf } = setup({
      course: '"kids"',
      done: JSON.stringify(range(0, 20)),
    })
    await actions.start()
    const theme = themeOf(20)
    expect(theme).toBeGreaterThan(0)
    expect(open()).toEqual([theme])
  })

  it('opening and closing by hand: kept apart, nothing written', async () => {
    const { ls, actions, open } = setup({ course: '"kids"' })
    await actions.start()
    const before = ls.snapshot()
    actions.setThemeOpen(5, true)
    actions.setThemeOpen(3, true)
    actions.setThemeOpen(0, false)
    expect(open()).toEqual([3, 5])
    expect(ls.snapshot()).toEqual(before)
  })

  it('the same state again → the session object stays the same', async () => {
    const { store, actions } = setup({ course: '"kids"' })
    await actions.start()
    const session = store.getState().session
    actions.setThemeOpen(0, true)
    actions.setThemeOpen(7, false)
    expect(store.getState().session).toBe(session)
  })

  it('other words, "Выучили" and tabs keep the open themes', async () => {
    const { actions, open } = setup({ course: '"kids"' })
    await actions.start()
    actions.setThemeOpen(0, false)
    actions.setThemeOpen(9, true)
    actions.showWord(120)
    actions.toggleLearned()
    actions.openTab('quiz')
    actions.openTab('plan')
    expect(open()).toEqual([9])
  })

  it("course change → only the theme of the new course's current word", async () => {
    const { actions, open, themeOf } = setup({
      course: '"kids"',
      'adult:done': JSON.stringify(range(0, 35)),
    })
    await actions.start()
    actions.setThemeOpen(9, true)
    expect(await actions.selectCourse('adult')).toBe(true)
    expect(open()).toEqual([themeOf(35)])
  })
})
