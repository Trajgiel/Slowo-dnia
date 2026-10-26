// Store from the factory on a fake storage and a fake loader: start-up for every storage variant,
// course choice, loading errors and retry, tab writes and deck reconciliation. After each sequence the
// storage holds exactly the keys and texts the prototype writes
// (architecture/react-port/storage.md → "«Старый пользователь»", "Когда что пишется";
// architecture/react-port/course-data.md → "Ошибка загрузки (П-6)").
import { describe, expect, it, vi } from 'vitest'
import { CourseLoadError, type CourseLoadErrorKind, type LoadCourse } from '../data'
import type { CourseData, CourseId } from '../domain'
import { createRepo } from '../storage'
import { FakeStorage } from '../test/fakeStorage'
import { seqRng } from '../test/rng'
import { createAppStore } from './appStore'

const KIDS: CourseData = {
  id: 'kids',
  themes: [['Тема', Array.from({ length: 500 }, (_, i) => [`k${String(i)}`, 'р', 'т'] as const)]],
  boy: { words: {}, themes: {} },
}
const ADULT: CourseData = {
  id: 'adult',
  themes: [['Тема', Array.from({ length: 1000 }, (_, i) => [`a${String(i)}`, 'р', 'т'] as const)]],
}

interface Deferred {
  resolve: () => void
  reject: (kind: CourseLoadErrorKind) => void
}

/** Loader: kids at once; adult as the `adult` queue says (`ok`, an error kind, or `wait` — settled by hand). */
function fakeLoader(adult: (CourseLoadErrorKind | 'ok' | 'wait')[] = ['ok']) {
  const pending: Deferred[] = []
  const load = vi.fn<LoadCourse>((id: CourseId) => {
    if (id === 'kids') return Promise.resolve(KIDS)
    const next = adult.length > 1 ? adult.shift() : adult[0]
    if (next === 'ok') return Promise.resolve(ADULT)
    if (next === 'wait') {
      return new Promise<CourseData>((resolve, reject) => {
        pending.push({
          resolve: () => {
            resolve(ADULT)
          },
          reject: (kind) => {
            reject(new CourseLoadError(kind, kind))
          },
        })
      })
    }
    return Promise.reject(new CourseLoadError(next ?? 'network', 'failed'))
  })
  return { load, pending }
}

function setup(items: Record<string, string> = {}, adult?: Parameters<typeof fakeLoader>[0]) {
  const ls = new FakeStorage(items)
  const loader = fakeLoader(adult)
  const store = createAppStore({
    storage: createRepo(() => ls),
    loadCourse: loader.load,
    now: () => new Date(2026, 9, 26, 12),
    rng: seqRng(0),
  })
  return { ls, loader, store, actions: store.getState().actions }
}

describe('start-up: which screen opens', () => {
  it('empty storage → course choice, nothing written, nothing loaded', async () => {
    const { ls, loader, store, actions } = setup()
    await actions.start()
    expect(store.getState().gate).toBe('choose')
    expect(ls.snapshot()).toEqual({})
    expect(loader.load).not.toHaveBeenCalled()
  })

  it.each(['""', 'null', '0', 'false'])(
    'course = %s and no other keys → course choice',
    async (v) => {
      const { ls, store, actions } = setup({ course: v })
      await actions.start()
      expect(store.getState().gate).toBe('choose')
      expect(ls.snapshot()).toEqual({ course: v })
    },
  )

  it.each(['done', 'days', 'kid', 'theme', 'tab', 'qmode'])(
    'no course, old key %s → kids course, course = "kids" written',
    async (key) => {
      const { ls, store, actions } = setup({ course: '""', [key]: '"x"' })
      await actions.start()
      expect(store.getState()).toMatchObject({ gate: 'ready', course: 'kids' })
      expect(ls.snapshot()).toEqual({ course: '"kids"', [key]: '"x"' })
    },
  )

  it.each(['adult:done', 'adult:days', 'qdir'])(
    'no course, only %s → course choice',
    async (key) => {
      const { ls, store, actions } = setup({ [key]: '[]' })
      await actions.start()
      expect(store.getState().gate).toBe('choose')
      expect(ls.snapshot()).toEqual({ [key]: '[]' })
    },
  )

  it.each(['"kids"', '"other"', '1', 'true', '{bad json'])(
    'course = %s → kids course, course = "kids" written',
    async (v) => {
      const { ls, store, actions } = setup({ course: v, theme: '"light"' })
      await actions.start()
      expect(store.getState()).toMatchObject({ gate: 'ready', course: 'kids', theme: 'light' })
      expect(ls.snapshot()).toEqual({ course: '"kids"', theme: '"light"' })
    },
  )

  it('course = "adult" → adult course, its progress and the first unlearned word', async () => {
    const { ls, store, actions } = setup({
      course: '"adult"',
      'adult:done': '[0,1,5000]',
      'adult:kid': '"boy"',
      qmode: '"free"',
    })
    await actions.start()
    const s = store.getState()
    expect(s).toMatchObject({ gate: 'ready', course: 'adult', gender: 'boy', quizMode: 'free' })
    expect([...s.done]).toEqual([0, 1])
    expect(s.words).toHaveLength(1000)
    expect(s.session.cur).toBe(2)
    expect(ls.snapshot()).toEqual({
      course: '"adult"',
      'adult:done': '[0,1,5000]',
      'adult:kid': '"boy"',
      qmode: '"free"',
    })
  })

  it('shows only the background while the course loads', async () => {
    const { store, loader, actions } = setup({ course: '"adult"' }, ['wait'])
    const started = actions.start()
    expect(store.getState().gate).toBe('loading')
    loader.pending[0]?.resolve()
    await started
    expect(store.getState().gate).toBe('ready')
  })

  it('runs once', async () => {
    const { loader, actions } = setup({ course: '"adult"' })
    await Promise.all([actions.start(), actions.start()])
    expect(loader.load).toHaveBeenCalledTimes(1)
  })

  it('storage that throws on every call → course choice, the app keeps working', async () => {
    const store = createAppStore({
      storage: createRepo(() => new FakeStorage({}, { throwOnRead: true, throwOnWrite: true })),
      loadCourse: fakeLoader().load,
      now: () => new Date(),
      rng: seqRng(0),
    })
    await store.getState().actions.start()
    expect(store.getState().gate).toBe('choose')
    expect(await store.getState().actions.selectCourse('kids')).toBe(true)
    expect(store.getState().gate).toBe('ready')
  })
})

describe('start-up: the adult course did not load', () => {
  const PROGRESS = {
    course: '"adult"',
    'adult:done': '[3]',
    done: '[1]',
    qmode: '"deck"',
  }

  it('→ "failed" screen; course stays "adult", nothing is written', async () => {
    const { ls, store, actions } = setup(PROGRESS, ['network'])
    await actions.start()
    expect(store.getState()).toMatchObject({
      gate: 'failed',
      course: null,
      courseLoad: { status: 'error', course: 'adult', error: 'network' },
    })
    expect(ls.snapshot()).toEqual(PROGRESS)
  })

  it.each(['not-found', 'invalid'] as const)(
    'keeps the error kind %s for the retry button',
    async (kind) => {
      const { store, actions } = setup(PROGRESS, [kind])
      await actions.start()
      expect(store.getState().courseLoad.error).toBe(kind)
    },
  )

  it('retry succeeds → adult course opens as at a normal start', async () => {
    const { ls, store, actions } = setup(PROGRESS, ['network', 'ok'])
    await actions.start()
    await actions.retryCourse()
    expect(store.getState()).toMatchObject({ gate: 'ready', course: 'adult', toast: null })
    // Deck mode with learned words: the deck is made at start, as the prototype's renderDeck does.
    expect(ls.snapshot()).toEqual({
      ...PROGRESS,
      'adult:deck_ru': '{"order":[3],"ans":{}}',
    })
  })

  it('retry fails again → stays, a new toast every time, nothing written', async () => {
    const { ls, store, actions } = setup(PROGRESS, ['network'])
    await actions.start()
    await actions.retryCourse()
    expect(store.getState()).toMatchObject({
      gate: 'failed',
      toast: { id: 'courseLoadFailed', seq: 1 },
    })
    await actions.retryCourse()
    expect(store.getState().toast).toEqual({ id: 'courseLoadFailed', seq: 2 })
    expect(ls.snapshot()).toEqual(PROGRESS)
  })

  it('a press while the retry is loading starts no second load', async () => {
    const { loader, store, actions } = setup(PROGRESS, ['network', 'wait'])
    await actions.start()
    const first = actions.retryCourse()
    const second = actions.retryCourse()
    expect(loader.load).toHaveBeenCalledTimes(2)
    loader.pending[0]?.resolve()
    await Promise.all([first, second])
    expect(store.getState().gate).toBe('ready')
  })

  it('does nothing outside the "failed" screen', async () => {
    const { loader, actions } = setup()
    await actions.start()
    await actions.retryCourse()
    expect(loader.load).not.toHaveBeenCalled()
  })
})

describe('course choice', () => {
  it('kids → course written, deck not made without learned words', async () => {
    const { ls, store, actions } = setup()
    await actions.start()
    expect(await actions.selectCourse('kids')).toBe(true)
    expect(store.getState()).toMatchObject({ gate: 'ready', course: 'kids' })
    expect(store.getState().session.cur).toBe(0)
    expect(ls.snapshot()).toEqual({ course: '"kids"' })
  })

  it('adult with progress kept from before → its deck is reconciled', async () => {
    const { ls, actions } = setup({ 'adult:done': '[4,2]', qdir: '"pl"' })
    await actions.start()
    await actions.selectCourse('adult')
    expect(ls.snapshot()).toEqual({
      'adult:done': '[4,2]',
      qdir: '"pl"',
      course: '"adult"',
      'adult:deck_pl': '{"order":[2,4],"ans":{}}',
    })
  })

  it('runs onLoaded after loading and before the course is shown', async () => {
    const { store, actions } = setup()
    await actions.start()
    const seen: string[] = []
    await actions.selectCourse('adult', () => {
      seen.push(store.getState().gate)
    })
    expect(seen).toEqual(['choose'])
  })

  it('adult fails → toast, stays on the choice, course not written', async () => {
    const { ls, store, actions } = setup({}, ['network'])
    await actions.start()
    const onLoaded = vi.fn()
    expect(await actions.selectCourse('adult', onLoaded)).toBe(false)
    expect(store.getState()).toMatchObject({
      gate: 'choose',
      course: null,
      toast: { id: 'courseLoadFailed', seq: 1 },
    })
    expect(onLoaded).not.toHaveBeenCalled()
    expect(ls.snapshot()).toEqual({})
  })

  it('a second press while loading is ignored', async () => {
    const { loader, store, actions } = setup({}, ['wait'])
    await actions.start()
    const adult = actions.selectCourse('adult')
    expect(await actions.selectCourse('kids')).toBe(false)
    loader.pending[0]?.resolve()
    expect(await adult).toBe(true)
    expect(store.getState().course).toBe('adult')
    expect(loader.load).toHaveBeenCalledTimes(1)
  })

  it('switching courses resets the session and keeps each course progress', async () => {
    const { ls, store, actions } = setup({ course: '"kids"', done: '[0]', qmode: '"free"' })
    await actions.start()
    expect(store.getState().session.cur).toBe(1)
    await actions.selectCourse('adult')
    expect(store.getState()).toMatchObject({ course: 'adult', session: { cur: 0 } })
    expect([...store.getState().done]).toEqual([])
    expect(ls.snapshot()).toEqual({ course: '"adult"', done: '[0]', qmode: '"free"' })
  })
})

describe('tabs', () => {
  it('opening a tab writes its name; the quiz reconciles the deck', async () => {
    const { ls, actions } = setup({ course: '"kids"', done: '[1,3]' })
    await actions.start()
    actions.openTab('plan')
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[1,3]',
      deck_ru: '{"order":[3,1],"ans":{}}',
      tab: '"plan"',
    })
    actions.openTab('quiz')
    expect(ls.snapshot()).toMatchObject({ tab: '"quiz"', deck_ru: '{"order":[3,1],"ans":{}}' })
  })

  it('quiz reconciles with the learned words of the store and appends new ones', async () => {
    const { ls, store, actions } = setup({
      course: '"kids"',
      done: '[1,3,7]',
      deck_ru: '{"order":[3,1],"ans":{"3":true}}',
    })
    await actions.start()
    expect(ls.snapshot().deck_ru).toBe('{"order":[3,1,7],"ans":{"3":true}}')
    actions.openTab('quiz')
    expect(ls.snapshot().deck_ru).toBe('{"order":[3,1,7],"ans":{"3":true}}')
    expect(store.getState().decks.ru).toEqual({ order: [3, 1, 7], ans: { 3: true } })
  })

  it('free mode or nothing learned → the deck is not touched', async () => {
    const variants: Record<string, string>[] = [
      { course: '"kids"', done: '[1]', qmode: '"free"' },
      { course: '"kids"', deck_ru: '"broken"' },
    ]
    for (const items of variants) {
      const { ls, actions } = setup(items)
      await actions.start()
      actions.openTab('quiz')
      expect(ls.snapshot()).toEqual({ ...items, tab: '"quiz"' })
    }
  })
})
