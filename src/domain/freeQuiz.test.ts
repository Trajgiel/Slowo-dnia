// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { seqRng } from '../test/rng'
import {
  INITIAL_FREE_QUIZ,
  freeWeight,
  needsNextFree,
  nextFree,
  pickFree,
  recentLimit,
  type FreeQuizState,
} from './freeQuiz'

describe('freeWeight', () => {
  it.each([
    [0, 1],
    [1, 3],
    [2, 5],
    [3, 7],
    [4, 7],
    [99, 7],
  ])('weak %i → weight %i', (weak, weight) => {
    expect(freeWeight(weak)).toBe(weight)
  })
})

describe('recentLimit', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [19, 9],
    [20, 10],
    [500, 10],
  ])('learned %i → %i', (done, limit) => {
    expect(recentLimit(done)).toBe(limit)
  })
})

describe('pickFree', () => {
  it('nothing learned → null', () => {
    expect(pickFree(new Set(), {}, [], seqRng(0.3))).toBeNull()
  })

  // Words 1 (weight 1), 2 (weak 1 → 3), 3 (weak 5 → 7): bag of 11 = [1, 2,2,2, 3×7].
  const done = new Set([1, 2, 3])
  const weak = { 2: 1, 3: 5 }
  it.each([
    [0, 1],
    [0.09, 1],
    [1 / 11, 2],
    [0.36, 2],
    [4 / 11, 3],
    [0.999, 3],
  ])('rng %f → word %i (weighted)', (r, word) => {
    expect(pickFree(done, weak, [], seqRng(r))).toBe(word)
  })

  it('recent words are skipped', () => {
    // Only word 1 is fresh.
    expect(pickFree(done, weak, [2, 3], seqRng(0.999))).toBe(1)
  })

  it('all words are recent → picks from all', () => {
    expect(pickFree(new Set([4]), {}, [4], seqRng(0.5))).toBe(4)
  })

  it('weighted choice is roughly proportional', () => {
    let state = 0
    // Simple LCG for a repeatable spread of values.
    const rng = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
    const counts = new Map<number, number>()
    for (let i = 0; i < 11000; i++) {
      const w = pickFree(done, weak, [], rng) ?? -1
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
    expect((counts.get(1) ?? 0) / 1000).toBeCloseTo(1, 0)
    expect((counts.get(2) ?? 0) / 1000).toBeCloseTo(3, 0)
    expect((counts.get(3) ?? 0) / 1000).toBeCloseTo(7, 0)
  })
})

describe('nextFree', () => {
  it('word first, then direction: rng < 0.5 → ru, else pl', () => {
    const done = new Set([1, 2, 3, 4])
    expect(nextFree(INITIAL_FREE_QUIZ, done, {}, seqRng(0, 0.49))).toEqual({
      idx: 1,
      dir: 'ru',
      recent: [1],
    })
    expect(nextFree(INITIAL_FREE_QUIZ, done, {}, seqRng(0.999, 0.5))).toEqual({
      idx: 4,
      dir: 'pl',
      recent: [4],
    })
  })

  it('recent keeps the last min(10, floor(done / 2)) words', () => {
    const done = new Set([1, 2, 3, 4]) // limit 2
    let s: FreeQuizState = INITIAL_FREE_QUIZ
    const rng = seqRng(0, 0.1)
    const shown: number[] = []
    for (let i = 0; i < 6; i++) {
      s = nextFree(s, done, {}, rng)
      shown.push(s.idx ?? -1)
      expect(s.recent.length).toBeLessThanOrEqual(2)
    }
    // Always the first fresh word: the two recent ones are skipped.
    expect(shown).toEqual([1, 2, 3, 1, 2, 3])
    expect(s.recent).toEqual([2, 3])
  })

  it('one learned word repeats (limit 0)', () => {
    const done = new Set([7])
    const s1 = nextFree(INITIAL_FREE_QUIZ, done, {}, seqRng(0.3))
    const s2 = nextFree(s1, done, {}, seqRng(0.3))
    expect([s1.idx, s2.idx]).toEqual([7, 7])
    expect(s2.recent).toEqual([])
  })

  it('nothing learned → idx null, recent unchanged', () => {
    const s = nextFree({ idx: 3, dir: 'pl', recent: [3] }, new Set(), {}, seqRng(0.1))
    expect(s).toEqual({ idx: null, dir: 'ru', recent: [3] })
  })

  it('does not change the input state', () => {
    const s: FreeQuizState = { idx: 1, dir: 'ru', recent: [1] }
    nextFree(s, new Set([1, 2, 3, 4]), {}, seqRng(0))
    expect(s.recent).toEqual([1])
  })
})

describe('needsNextFree', () => {
  it.each<[FreeQuizState, number[], boolean]>([
    [INITIAL_FREE_QUIZ, [1], true],
    [{ idx: 1, dir: 'ru', recent: [1] }, [1], false],
    [{ idx: 1, dir: 'ru', recent: [1] }, [2], true],
  ])('%j with done %j → %s', (state, done, needed) => {
    expect(needsNextFree(state, new Set(done))).toBe(needed)
  })
})
