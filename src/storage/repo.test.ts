import { describe, expect, it } from 'vitest'
import type { CourseId } from '../domain'
import { FakeStorage, type FakeStorageOptions } from '../test/fakeStorage'
import { createRepo } from './repo'

function setup(items: Record<string, string> = {}, options: FakeStorageOptions = {}) {
  const fake = new FakeStorage(items, options)
  return { fake, repo: createRepo(() => fake) }
}

type StartRow = [name: string, items: Record<string, string>, expected: CourseId | null]

describe('readStartCourse (analyst/features/react-port/us-1-start.md → "Какой экран открывается")', () => {
  it.each<StartRow>([
    ['empty storage → course choice', {}, null],
    ['course "kids"', { course: '"kids"' }, 'kids'],
    ['course "adult"', { course: '"adult"' }, 'adult'],
    ['course of another value → kids', { course: '"teen"' }, 'kids'],
    ['course a number → kids', { course: '7' }, 'kids'],
    ['course broken JSON, no old keys → course choice', { course: '{x' }, null],
    ['course null, old key → kids', { course: 'null', theme: '"dark"' }, 'kids'],
    ...['done', 'days', 'kid', 'theme', 'tab', 'qmode'].map((key): StartRow => [
      `no course, old key "${key}" → kids`,
      { [key]: '"x"' },
      'kids',
    ]),
    ['old key with broken JSON still counts', { done: '{oops' }, 'kids'],
    ['old key with "null" text still counts', { tab: 'null' }, 'kids'],
    ['only qdir → course choice', { qdir: '"pl"' }, null],
    ['only adult keys → course choice', { 'adult:done': '[1]', 'adult:kid': '"boy"' }, null],
    ['only weak / deck keys → course choice', { weak: '{}', deck_ru: 'null' }, null],
  ])('%s', (_, items, expected) => {
    const { fake, repo } = setup(items)
    expect(repo.readStartCourse()).toBe(expected)
    expect(fake.snapshot()).toEqual(items)
  })

  it('storage throwing on read → course choice', () => {
    expect(setup({ done: '[1]' }, { throwOnRead: true }).repo.readStartCourse()).toBeNull()
  })
})

describe('settings', () => {
  it('reads defaults from empty storage', () => {
    const { repo } = setup()
    expect([repo.readTheme(), repo.readQuizMode(), repo.readQuizDir()]).toEqual([
      'dark',
      'deck',
      'ru',
    ])
  })

  it('unknown qmode / qdir → defaults, keys not rewritten', () => {
    const items = { qmode: '"endless"', qdir: '"de"', theme: '"blue"' }
    const { fake, repo } = setup(items)
    expect([repo.readQuizMode(), repo.readQuizDir(), repo.readTheme()]).toEqual([
      'deck',
      'ru',
      'dark',
    ])
    expect(fake.snapshot()).toEqual(items)
  })

  it('writes the prototype text', () => {
    const { fake, repo } = setup()
    repo.writeCourse('adult')
    repo.writeTheme('light')
    repo.writeQuizMode('free')
    repo.writeQuizDir('pl')
    repo.writeTab('plan')
    expect(fake.snapshot()).toEqual({
      course: '"adult"',
      theme: '"light"',
      qmode: '"free"',
      qdir: '"pl"',
      tab: '"plan"',
    })
    expect([repo.readTheme(), repo.readQuizMode(), repo.readQuizDir()]).toEqual([
      'light',
      'free',
      'pl',
    ])
  })
})

describe('course state', () => {
  it('kids keys have no prefix, adult keys have "adult:"', () => {
    const { repo } = setup({
      kid: '"boy"',
      done: '[0,499,500]',
      weak: '{"0":2}',
      days: '["2026-10-25"]',
      'adult:done': '[500,999,1000]',
    })
    const kids = repo.readCourseState('kids')
    expect(kids.gender).toBe('boy')
    expect([...kids.done]).toEqual([0, 499])
    expect(kids.weak).toEqual({ 0: 2 })
    expect(kids.days).toEqual(['2026-10-25'])
    const adult = repo.readCourseState('adult')
    expect(adult).toMatchObject({ gender: 'girl', weak: {}, days: [] })
    expect([...adult.done]).toEqual([500, 999])
  })

  it('corrupted values → defaults, nothing rewritten', () => {
    const items = { kid: '1', done: '{"a":1}', weak: '[1]', days: '{bad' }
    const { fake, repo } = setup(items)
    const state = repo.readCourseState('kids')
    expect(state).toMatchObject({ gender: 'girl', weak: {}, days: [] })
    expect(state.done.size).toBe(0)
    expect(fake.snapshot()).toEqual(items)
  })

  it('writeProgress writes done (sorted), weak and days as the prototype save()', () => {
    const { fake, repo } = setup()
    repo.writeProgress('adult', {
      done: new Set([12, 3, 100]),
      weak: { 100: 1, 3: 2 },
      days: ['2026-10-24', '2026-10-26'],
    })
    repo.writeGender('adult', 'boy')
    expect(fake.snapshot()).toEqual({
      'adult:done': '[3,12,100]',
      'adult:weak': '{"3":2,"100":1}',
      'adult:days': '["2026-10-24","2026-10-26"]',
      'adult:kid': '"boy"',
    })
  })
})

describe('deck and results', () => {
  it('reads a deck written by the prototype and writes it back as the same text', () => {
    const text = '{"order":[5,2,9],"ans":{"2":false,"5":true}}'
    const { fake, repo } = setup({ deck_pl: text })
    const deck = repo.readDeck('kids', 'pl')
    expect(deck).toEqual({ order: [5, 2, 9], ans: { 5: true, 2: false } })
    if (!deck) throw new Error('deck expected')
    repo.writeDeck('kids', 'pl', deck)
    expect(fake.items.get('deck_pl')).toBe(text)
  })

  it.each([
    ['missing', {}],
    ['no order', { 'adult:deck_ru': '{"ans":{}}' }],
    ['no ans', { 'adult:deck_ru': '{"order":[1]}' }],
    ['null', { 'adult:deck_ru': 'null' }],
    ['broken JSON', { 'adult:deck_ru': '{"order":[' }],
  ])('deck %s → null (store makes a new one), key not rewritten', (_, items) => {
    const { fake, repo } = setup(items)
    expect(repo.readDeck('adult', 'ru')).toBeNull()
    expect(fake.snapshot()).toEqual(items)
  })

  it('results: written in the order right, wrong, total, date; read back', () => {
    const { fake, repo } = setup()
    repo.writePrevResult('kids', 'ru', { date: '2026-10-20', total: 4, wrong: 1, right: 3 })
    repo.writeLastResult('kids', 'ru', { right: 5, wrong: 0, total: 5, date: '2026-10-26' })
    expect(fake.snapshot()).toEqual({
      prev_ru: '{"right":3,"wrong":1,"total":4,"date":"2026-10-20"}',
      last_ru: '{"right":5,"wrong":0,"total":5,"date":"2026-10-26"}',
    })
    expect(repo.readDeckResults('kids', 'ru')).toEqual({
      last: { right: 5, wrong: 0, total: 5, date: '2026-10-26' },
      prev: { right: 3, wrong: 1, total: 4, date: '2026-10-20' },
    })
    expect(repo.readDeckResults('kids', 'pl')).toEqual({ last: null, prev: null })
  })

  it('replaceCourse: progress, then deck_/last_/prev_ of both directions = null; other course intact', () => {
    const { fake, repo } = setup({ done: '[1]', deck_ru: '{"order":[1],"ans":{}}' })
    repo.replaceCourse('adult', { done: [7, 3, 7], weak: {}, days: [] })
    expect(fake.snapshot()).toEqual({
      done: '[1]',
      deck_ru: '{"order":[1],"ans":{}}',
      'adult:done': '[3,7]',
      'adult:weak': '{}',
      'adult:days': '[]',
      'adult:deck_ru': 'null',
      'adult:last_ru': 'null',
      'adult:prev_ru': 'null',
      'adult:deck_pl': 'null',
      'adult:last_pl': 'null',
      'adult:prev_pl': 'null',
    })
    expect(repo.readDeck('adult', 'ru')).toBeNull()
  })
})

describe('storage unavailable (private mode)', () => {
  it.each([
    ['write throws', { throwOnWrite: true }],
    ['read and write throw', { throwOnRead: true, throwOnWrite: true }],
  ])('%s → works on memory for the session, nothing saved', (_, options) => {
    const { fake, repo } = setup({}, options)
    expect(() => {
      repo.writeCourse('kids')
      repo.writeTheme('light')
      repo.writeProgress('kids', { done: new Set([2]), weak: {}, days: ['2026-10-26'] })
      repo.writeDeck('kids', 'ru', { order: [2], ans: {} })
    }).not.toThrow()
    expect(repo.readStartCourse()).toBe('kids')
    expect(repo.readTheme()).toBe('light')
    expect([...repo.readCourseState('kids').done]).toEqual([2])
    expect(repo.readDeck('kids', 'ru')).toEqual({ order: [2], ans: {} })
    expect(fake.items.size).toBe(0)
  })
})
