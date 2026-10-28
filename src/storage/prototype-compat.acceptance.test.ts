// SD-9 acceptance (qa): the new storage against the prototype's own storage code (src/test/prototypeStore.ts,
// a copy of materials/project/index.html in the workspace) on the page `localStorage` (jsdom), through the
// app's `storage` instance.
// Covers:
// - tasks SD-9 "Записанный текст значений совпадает с прототипом символ в символ"; us-8-data.md → "Ключи и
//   форматы": the same actions leave the same text in every key of both courses, and data written by the
//   prototype reads as the prototype reads it (old user, both courses, decks, results, settings);
// - us-1-start.md → "Какой экран открывается": every combination of `course` and the pre-course keys gives the
//   prototype's start course; reading writes nothing;
// - tasks SD-9 "Испорченный JSON, значения не того типа, колода без order / ans", "qmode / qdir с неизвестным
//   значением", "done с нецелыми и вне курса": every broken value is read without exceptions, and each place
//   where the result differs from the prototype is listed here on purpose (a new difference fails the test);
// - tasks SD-9 "localStorage, бросающий исключения": the page's `localStorage` itself refuses access
//   (storage disabled in the browser) → the app works on memory for the session.
// Not here: parse tables of each codec, kv on a fake storage, key names (src/storage/*.test.ts, developer);
// when the store writes which key (SD-12 and screen tasks).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseId, QuizDir } from '../domain'
import {
  protoDeckSolved,
  protoGetDeck,
  protoLoadState,
  protoResults,
  protoSave,
  protoSetDeck,
  protoSetSetting,
  protoSettings,
  protoStartCourse,
  protoWriteCourse,
  snapshot,
} from '../test/prototypeStore'
import { createRepo, storage } from '.'

beforeEach(() => {
  localStorage.clear()
})

const COURSES: readonly CourseId[] = ['kids', 'adult']
const DIRS: readonly QuizDir[] = ['ru', 'pl']

/** What the new storage reads, in the prototype's terms. */
function readAsPrototype(course: CourseId) {
  const s = storage.readCourseState(course)
  return { girlForms: s.gender === 'girl', done: new Set(s.done), weak: s.weak, days: s.days }
}

function expectSameReading() {
  const before = snapshot(localStorage)
  expect(storage.readStartCourse()).toBe(protoStartCourse(localStorage))
  localStorage.clear()
  for (const [k, v] of Object.entries(before)) localStorage.setItem(k, v)
  for (const course of COURSES) {
    const proto = protoLoadState(localStorage, course)
    expect(readAsPrototype(course)).toEqual({
      girlForms: proto.girlForms,
      done: proto.done,
      weak: proto.weak,
      days: proto.days,
    })
    for (const dir of DIRS) {
      expect(storage.readDeckResults(course, dir)).toEqual(protoResults(localStorage, course, dir))
      const deck = storage.readDeck(course, dir)
      const proto = protoGetDeck(localStorage, course, dir, () => ({ order: [], ans: {} }))
      expect(deck === null).toBe(proto.replaced)
      if (deck) expect(deck).toEqual(proto.deck)
    }
  }
  const settings = protoSettings(localStorage)
  expect({
    mode: storage.readQuizMode(),
    dir: storage.readQuizDir(),
    light: storage.readTheme() === 'light',
  }).toEqual(settings)
}

describe('the same actions → the same text in localStorage as the prototype (both courses)', () => {
  // A user of both courses: words learned out of order, forgotten words, days, gender, decks in both
  // directions with answers, solved decks (last and prev), settings, then a restore from a code.
  function prototypeSession(): Record<string, string> {
    const ls = localStorage
    protoSetSetting(ls, 'theme', 'light')
    protoSave(ls, 'kids', new Set([7, 2, 0, 499, 13]), { 13: 1, 2: 3, 7: 1 }, ['2026-10-24'])
    protoSetSetting(ls, 'kid', 'boy')
    protoSetSetting(ls, 'qmode', 'free')
    protoSetSetting(ls, 'qdir', 'pl')
    protoSetSetting(ls, 'tab', 'quiz')
    protoSetDeck(ls, 'kids', 'ru', { order: [13, 7, 0, 2, 499], ans: { 7: true, 13: false } })
    protoSetDeck(ls, 'kids', 'pl', { order: [2, 0], ans: { 2: true, 0: true } })
    protoDeckSolved(ls, 'kids', 'pl', { right: 2, wrong: 0, total: 2 }, '2026-10-20')
    protoDeckSolved(ls, 'kids', 'pl', { right: 1, wrong: 1, total: 2 }, '2026-10-25')
    protoSetSetting(ls, 'course', 'adult')
    protoSave(ls, 'adult', new Set([999, 100, 5]), {}, ['2026-10-25', '2026-10-26'])
    protoSetSetting(ls, 'adult:kid', 'girl')
    protoSetDeck(ls, 'adult', 'ru', { order: [999, 5, 100], ans: { 999: false } })
    protoDeckSolved(ls, 'adult', 'ru', { right: 0, wrong: 3, total: 3 }, '2026-10-26')
    protoWriteCourse(ls, 'adult', {
      done: [42, 3, 42, 998],
      weak: { 998: 2, 42: 1 },
      days: ['2026-09-01'],
    })
    return snapshot(ls)
  }

  function newVersionSession(): Record<string, string> {
    const s = storage
    s.writeTheme('light')
    s.writeProgress('kids', {
      done: new Set([7, 2, 0, 499, 13]),
      weak: { 13: 1, 2: 3, 7: 1 },
      days: ['2026-10-24'],
    })
    s.writeGender('kids', 'boy')
    s.writeQuizMode('free')
    s.writeQuizDir('pl')
    s.writeTab('quiz')
    s.writeDeck('kids', 'ru', { order: [13, 7, 0, 2, 499], ans: { 7: true, 13: false } })
    s.writeDeck('kids', 'pl', { order: [2, 0], ans: { 2: true, 0: true } })
    s.writeLastResult('kids', 'pl', { right: 2, wrong: 0, total: 2, date: '2026-10-20' })
    const { last } = s.readDeckResults('kids', 'pl')
    if (last) s.writePrevResult('kids', 'pl', last)
    s.writeLastResult('kids', 'pl', { right: 1, wrong: 1, total: 2, date: '2026-10-25' })
    s.writeCourse('adult')
    s.writeProgress('adult', {
      done: new Set([999, 100, 5]),
      weak: {},
      days: ['2026-10-25', '2026-10-26'],
    })
    s.writeGender('adult', 'girl')
    s.writeDeck('adult', 'ru', { order: [999, 5, 100], ans: { 999: false } })
    s.writeLastResult('adult', 'ru', { right: 0, wrong: 3, total: 3, date: '2026-10-26' })
    s.replaceCourse('adult', {
      done: [42, 3, 42, 998],
      weak: { 998: 2, 42: 1 },
      days: ['2026-09-01'],
    })
    return snapshot(localStorage)
  }

  it('every key, character for character; each version reads what the other wrote', () => {
    const prototypeText = prototypeSession()
    expectSameReading()

    localStorage.clear()
    const newText = newVersionSession()
    expect(newText).toEqual(prototypeText)
    // Spot check that the session really wrote prototype-shaped text (not just two equal mistakes).
    expect(newText.done).toBe('[0,2,7,13,499]')
    expect(newText['adult:done']).toBe('[3,42,998]')
    expect(newText.prev_pl).toBe('{"right":2,"wrong":0,"total":2,"date":"2026-10-20"}')
    expect(newText.deck_ru).toBe('{"order":[13,7,0,2,499],"ans":{"7":true,"13":false}}')
    expectSameReading()
  })

  it('reading a prototype user never rewrites a key', () => {
    prototypeSession()
    const before = snapshot(localStorage)
    storage.readStartCourse()
    for (const course of COURSES) {
      storage.readCourseState(course)
      for (const dir of DIRS) {
        storage.readDeck(course, dir)
        storage.readDeckResults(course, dir)
      }
    }
    storage.readQuizMode()
    storage.readQuizDir()
    storage.readTheme()
    expect(snapshot(localStorage)).toEqual(before)
  })
})

describe('start course: every combination of `course` and pre-course keys, as the prototype', () => {
  const PRE_COURSE = ['done', 'days', 'kid', 'theme', 'tab', 'qmode']
  // Raw text of `course`; `undefined` — no key.
  const COURSE_TEXT = [
    undefined,
    '"kids"',
    '"adult"',
    '"teen"',
    'null',
    '{broken',
    '""',
    '0',
    'false',
    '7',
  ]
  // Keys that do not make an "old user" (adult course, qdir, other kids keys).
  const NOISE: readonly Record<string, string>[] = [
    {},
    { qdir: '"pl"', 'adult:done': '[1]', 'adult:kid': '"boy"', weak: '{}', deck_ru: 'null' },
  ]
  const PRE_COURSE_TEXT = ['"x"', 'null', '{broken', '[]']

  it('the same course (or the course choice) and nothing written by reading', () => {
    let cases = 0
    for (const courseText of COURSE_TEXT) {
      for (let mask = 0; mask < 1 << PRE_COURSE.length; mask++) {
        for (const noise of NOISE) {
          localStorage.clear()
          const items: Record<string, string> = { ...noise }
          if (courseText !== undefined) items.course = courseText
          PRE_COURSE.forEach((key, i) => {
            if (mask & (1 << i))
              items[key] = PRE_COURSE_TEXT[(mask + i) % PRE_COURSE_TEXT.length] ?? ''
          })
          for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v)

          const actual = storage.readStartCourse()
          expect(snapshot(localStorage), JSON.stringify(items)).toEqual(items)
          expect(actual, JSON.stringify(items)).toBe(protoStartCourse(localStorage))
          cases++
        }
      }
    }
    expect(cases).toBe(COURSE_TEXT.length * 64 * NOISE.length)
  })
})

describe('broken and unexpected values: no exceptions; differences from the prototype are listed', () => {
  // "same" — reads as the prototype; "prototype crashes" — the prototype throws while loading, the new
  // version uses the default; "differs" — a value the prototype never writes itself (hand-edited or broken
  // storage), read more strictly by the architecture rules or an owner decision.
  type Verdict = 'same' | 'prototype crashes' | 'differs'
  interface Row {
    readonly name: string
    readonly items: Record<string, string>
    readonly verdict: Verdict
    /** [what the new version reads, how the prototype reads it]. */
    readonly read: () => [unknown, () => unknown]
  }

  const gender = (course: CourseId): [unknown, () => unknown] => [
    readAsPrototype(course).girlForms,
    () => protoLoadState(localStorage, course).girlForms,
  ]
  const state =
    (field: 'done' | 'weak' | 'days', course: CourseId = 'kids') =>
    (): [unknown, () => unknown] => [
      readAsPrototype(course)[field],
      () => protoLoadState(localStorage, course)[field],
    ]
  const deck = (course: CourseId, dir: QuizDir) => (): [unknown, () => unknown] => [
    storage.readDeck(course, dir),
    () => {
      const proto = protoGetDeck(localStorage, course, dir, () => ({ order: [], ans: {} }))
      return proto.replaced ? null : proto.deck
    },
  ]
  const last = (): [unknown, () => unknown] => [
    storage.readDeckResults('kids', 'ru').last,
    () => protoResults(localStorage, 'kids', 'ru').last,
  ]
  const setting = (): [unknown, () => unknown] => [
    [storage.readQuizMode(), storage.readQuizDir(), storage.readTheme() === 'light'],
    () => {
      const p = protoSettings(localStorage)
      return [p.mode, p.dir, p.light]
    },
  ]

  const rows: Row[] = [
    // gender: prototype `girl = kid === "girl"` — any other value gives boy / man forms
    { name: 'kid "boy"', items: { kid: '"boy"' }, verdict: 'same', read: () => gender('kids') },
    { name: 'kid missing', items: {}, verdict: 'same', read: () => gender('adult') },
    { name: 'kid broken JSON', items: { kid: '{x' }, verdict: 'same', read: () => gender('kids') },
    {
      name: 'kid "Boy" (unknown)',
      items: { kid: '"Boy"' },
      verdict: 'same',
      read: () => gender('kids'),
    },
    {
      name: 'kid null',
      items: { 'adult:kid': 'null' },
      verdict: 'same',
      read: () => gender('adult'),
    },
    // done
    {
      name: 'done with repeats, non-integers, out of the kids course',
      items: { done: '[13,2,2,1.5,-1,500,"3",null]' },
      verdict: 'same',
      read: state('done'),
    },
    {
      name: 'adult done at the course border',
      items: { 'adult:done': '[999,1000,0]' },
      verdict: 'same',
      read: state('done', 'adult'),
    },
    { name: 'done broken JSON', items: { done: '[1,' }, verdict: 'same', read: state('done') },
    {
      name: 'done an object',
      items: { done: '{"0":1}' },
      verdict: 'prototype crashes',
      read: state('done'),
    },
    {
      name: 'done null',
      items: { done: 'null' },
      verdict: 'prototype crashes',
      read: state('done'),
    },
    {
      name: 'done a string',
      items: { done: '"1,2"' },
      verdict: 'prototype crashes',
      read: state('done'),
    },
    // weak / days: the prototype keeps any value as is
    { name: 'weak broken JSON', items: { weak: '{' }, verdict: 'same', read: state('weak') },
    { name: 'weak an array', items: { weak: '[1]' }, verdict: 'differs', read: state('weak') },
    {
      name: 'weak count a string',
      items: { weak: '{"3":"2"}' },
      verdict: 'differs',
      read: state('weak'),
    },
    { name: 'days broken JSON', items: { days: '["2026' }, verdict: 'same', read: state('days') },
    {
      name: 'days with a number',
      items: { days: '["2026-10-25",1]' },
      verdict: 'differs',
      read: state('days'),
    },
    // decks: the prototype makes a new deck without `order` array or `ans` object
    {
      name: 'deck without order',
      items: { deck_ru: '{"ans":{}}' },
      verdict: 'same',
      read: deck('kids', 'ru'),
    },
    {
      name: 'deck without ans',
      items: { 'adult:deck_pl': '{"order":[1]}' },
      verdict: 'same',
      read: deck('adult', 'pl'),
    },
    {
      name: 'deck ans null',
      items: { deck_pl: '{"order":[1],"ans":null}' },
      verdict: 'same',
      read: deck('kids', 'pl'),
    },
    { name: 'deck null', items: { deck_ru: 'null' }, verdict: 'same', read: deck('kids', 'ru') },
    {
      name: 'deck broken JSON',
      items: { deck_ru: '{"order":[' },
      verdict: 'same',
      read: deck('kids', 'ru'),
    },
    {
      name: 'deck ans an array',
      items: { deck_ru: '{"order":[1],"ans":[]}' },
      verdict: 'differs',
      read: deck('kids', 'ru'),
    },
    {
      name: 'deck with a string in order and a non-boolean answer',
      items: { deck_ru: '{"order":[1,"2"],"ans":{"1":"yes"}}' },
      verdict: 'differs',
      read: deck('kids', 'ru'),
    },
    // results
    { name: 'last broken JSON', items: { last_ru: '{"right"' }, verdict: 'same', read: last },
    {
      name: 'last without date',
      items: { last_ru: '{"right":3,"wrong":1,"total":4}' },
      verdict: 'same',
      read: last,
    },
    { name: 'last a string', items: { last_ru: '"x"' }, verdict: 'differs', read: last },
    // settings
    { name: 'theme unknown', items: { theme: '"blue"' }, verdict: 'same', read: setting },
    // owner decision (decisions/product/2026-10-25-v01-react-port.md → "Осознанные отличия", п. 6)
    {
      name: 'qmode / qdir unknown',
      items: { qmode: '"endless"', qdir: '"de"' },
      verdict: 'differs',
      read: setting,
    },
  ]

  const comparable = (v: unknown): string =>
    JSON.stringify(v instanceof Set ? [...(v as Set<number>)].sort((a, b) => a - b) : v)

  it.each(rows)('$name → $verdict', ({ items, verdict, read }) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v)
    // The new version first: it must never throw.
    const [next, proto] = read()
    let actual: Verdict
    let protoValue: unknown
    try {
      protoValue = proto()
      actual = comparable(next) === comparable(protoValue) ? 'same' : 'differs'
    } catch {
      actual = 'prototype crashes'
    }
    expect(actual, `new ${comparable(next)}, prototype ${comparable(protoValue)}`).toBe(verdict)
  })

  it('reading the new version never throws, for every row at once', () => {
    for (const { items } of rows)
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v)
    expect(() => {
      expectNoThrowReadAll()
    }).not.toThrow()
  })

  function expectNoThrowReadAll() {
    storage.readStartCourse()
    for (const course of COURSES) {
      storage.readCourseState(course)
      for (const dir of DIRS) {
        storage.readDeck(course, dir)
        storage.readDeckResults(course, dir)
      }
    }
    storage.readQuizMode()
    storage.readQuizDir()
    storage.readTheme()
  }
})

describe('page localStorage refuses access (storage disabled in the browser)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('the app works on memory for the session; nothing reaches localStorage', () => {
    localStorage.setItem('done', '[1]')
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    const repo = createRepo()
    expect(repo.readStartCourse()).toBeNull()
    expect(() => {
      repo.writeCourse('adult')
      repo.writeProgress('adult', { done: new Set([5, 1]), weak: { 5: 1 }, days: ['2026-10-26'] })
      repo.writeDeck('adult', 'pl', { order: [5, 1], ans: { 5: true } })
    }).not.toThrow()
    expect(repo.readStartCourse()).toBe('adult')
    const state = repo.readCourseState('adult')
    expect([...state.done].sort()).toEqual([1, 5])
    expect(state.weak).toEqual({ 5: 1 })
    expect(repo.readDeck('adult', 'pl')).toEqual({ order: [5, 1], ans: { 5: true } })

    vi.restoreAllMocks()
    expect(snapshot(localStorage)).toEqual({ done: '[1]' })
  })
})
