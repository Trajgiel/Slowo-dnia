import { describe, expect, it } from 'vitest'
import { FakeStorage, type FakeStorageOptions } from '../test/fakeStorage'
import { createRepo } from './repo'

function setup(items: Record<string, string> = {}, options: FakeStorageOptions = {}) {
  const fake = new FakeStorage(items, options)
  return { fake, repo: createRepo(() => fake) }
}

describe('readStartCourse (analyst/features/react-port/us-1-start.md → "Какой экран открывается")', () => {
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
    const items = { qmode: '"endless"', qdir: '"de"' }
    const { fake, repo } = setup(items)
    expect([repo.readQuizMode(), repo.readQuizDir()]).toEqual(['deck', 'ru'])
    expect(fake.snapshot()).toEqual(items)
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
    expect(state).toMatchObject({ gender: 'boy', weak: {}, days: [] })
    expect(state.done.size).toBe(0)
    expect(fake.snapshot()).toEqual(items)
  })
})

describe('deck and results', () => {
  it('missing deck → null (store makes a new one), nothing written', () => {
    const { fake, repo } = setup({})
    expect(repo.readDeck('adult', 'ru')).toBeNull()
    expect(fake.snapshot()).toEqual({})
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
