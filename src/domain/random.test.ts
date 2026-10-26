// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { seqRng } from '../test/rng'
import { shuffle } from './random'

describe('shuffle', () => {
  it('walks Fisher-Yates from the end like the prototype', () => {
    // i=3: j=floor(0*4)=0 → [4,2,3,1]; i=2: j=floor(0.5*3)=1 → [4,3,2,1]; i=1: j=floor(0.99*2)=1 → same
    expect(shuffle([1, 2, 3, 4], seqRng(0, 0.5, 0.99))).toEqual([4, 3, 2, 1])
  })

  it('rng close to 1 keeps the order', () => {
    expect(shuffle([1, 2, 3], seqRng(0.999))).toEqual([1, 2, 3])
  })

  it('shuffles in place and keeps all items', () => {
    const items = [5, 6, 7, 8, 9]
    const out = shuffle(items, Math.random)
    expect(out).toBe(items)
    expect([...out].sort()).toEqual([5, 6, 7, 8, 9])
  })

  it.each([[[]], [[1]]])('%j needs no rng', (items) => {
    expect(shuffle([...items], () => Number.NaN)).toEqual(items)
  })
})
