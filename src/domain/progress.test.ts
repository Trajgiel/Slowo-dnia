// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Word } from './course'
import {
  MAX_DAYS,
  nextIdx,
  percentLearned,
  praiseFor,
  sanitizeDone,
  themeCounts,
  themeWordIndices,
  toggleLearned,
} from './progress'

const w = (ti: number, theme: string): Word => ({ pl: 'p', ru: 'r', tr: 't', ti, theme })
// Theme 0: words 0–2, theme 1: words 3–4.
const words: Word[] = [w(0, 'A'), w(0, 'A'), w(0, 'A'), w(1, 'B'), w(1, 'B')]

describe('sanitizeDone', () => {
  it('keeps only integers 0 <= i < N', () => {
    expect([...sanitizeDone([0, 4, 5, -1, 1.5, '2', null, 3, 3, Number.NaN], 5)]).toEqual([0, 4, 3])
  })
})

describe('nextIdx', () => {
  it.each([
    [[], 0],
    [[0, 1], 2],
    [[1, 2], 0],
    [[0, 1, 2, 3, 4], 4],
    [[0, 1, 2, 4], 3],
  ])('done %j → %i', (done, idx) => {
    expect(nextIdx(new Set(done), 5)).toBe(idx)
  })
})

describe('toggleLearned', () => {
  const now = new Date(2026, 9, 26, 23, 30)

  it('marks a word and adds today', () => {
    const r = toggleLearned(new Set([1]), ['2026-10-25'], 2, now)
    expect([...r.done]).toEqual([1, 2])
    expect(r.days).toEqual(['2026-10-25', '2026-10-26'])
    expect(r.learned).toBe(true)
  })

  it('does not add today twice', () => {
    const r = toggleLearned(new Set(), ['2026-10-26'], 0, now)
    expect(r.days).toEqual(['2026-10-26'])
  })

  it('unmarking keeps days', () => {
    const r = toggleLearned(new Set([2]), ['2026-10-26'], 2, now)
    expect([...r.done]).toEqual([])
    expect(r.days).toEqual(['2026-10-26'])
    expect(r.learned).toBe(false)
  })

  it('keeps the last 400 days', () => {
    const days = Array.from({ length: MAX_DAYS }, (_, i) => `d${String(i)}`)
    const r = toggleLearned(new Set(), days, 0, now)
    expect(r.days).toHaveLength(400)
    expect(r.days[0]).toBe('d1')
    expect(r.days.at(-1)).toBe('2026-10-26')
  })

  it('00:30 next night is a new day', () => {
    const first = toggleLearned(new Set(), [], 0, now)
    const second = toggleLearned(first.done, first.days, 1, new Date(2026, 9, 27, 0, 30))
    expect(second.days).toEqual(['2026-10-26', '2026-10-27'])
  })

  it('does not change the inputs', () => {
    const done = new Set([1])
    const days = ['2026-10-25']
    toggleLearned(done, days, 2, now)
    toggleLearned(done, days, 1, now)
    expect([...done]).toEqual([1])
    expect(days).toEqual(['2026-10-25'])
  })
})

describe('percentLearned', () => {
  it.each([
    [0, 500, 0],
    [1, 500, 0],
    [3, 500, 1],
    [250, 500, 50],
    [997, 1000, 100],
    [995, 1000, 100],
    [994, 1000, 99],
    [0, 0, 0],
  ])('%i of %i → %i%%', (done, n, pct) => {
    expect(percentLearned(done, n)).toBe(pct)
  })
})

describe('themes', () => {
  it('themeWordIndices lists the words of a theme', () => {
    expect(themeWordIndices(words, 0)).toEqual([0, 1, 2])
    expect(themeWordIndices(words, 1)).toEqual([3, 4])
  })

  it('themeCounts: learned / total and full', () => {
    expect(themeCounts(words, new Set([0, 3, 4]))).toEqual([
      { ti: 0, theme: 'A', done: 1, total: 3, full: false },
      { ti: 1, theme: 'B', done: 2, total: 2, full: true },
    ])
  })
})

describe('praiseFor', () => {
  it.each([
    ['all words learned → only "all"', [0, 1, 2, 3, 4], 4, { kind: 'all', total: 5 }],
    ['theme completed', [3, 4], 4, { kind: 'theme', theme: 'B' }],
    ['theme completed, other theme partly', [0, 1, 2, 3], 2, { kind: 'theme', theme: 'A' }],
    ['theme not completed', [0, 1], 1, null],
  ])('%s', (_, done, index, praise) => {
    expect(praiseFor(words, new Set(done), index)).toEqual(praise)
  })
})
