// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { markWeak, weakCount, type Weak } from './weak'

describe('markWeak', () => {
  it.each<[string, Weak, number, boolean, Weak]>([
    ['forgot a new word → 1', {}, 3, false, { 3: 1 }],
    ['forgot again → +1', { 3: 1 }, 3, false, { 3: 2 }],
    ['no upper cap on answers', { 3: 99 }, 3, false, { 3: 100 }],
    ['recalled → −1', { 3: 2 }, 3, true, { 3: 1 }],
    ['recalled at 1 → entry removed', { 3: 1, 7: 2 }, 3, true, { 7: 2 }],
    ['recalled a word not in weak → nothing', { 7: 2 }, 3, true, { 7: 2 }],
  ])('%s', (_, weak, index, recalled, expected) => {
    expect(markWeak(weak, index, recalled)).toEqual(expected)
  })

  it('does not change the input', () => {
    const weak = { 3: 1 }
    markWeak(weak, 3, true)
    markWeak(weak, 4, false)
    expect(weak).toEqual({ 3: 1 })
  })

  it('serializes like the prototype: numeric keys ascending', () => {
    expect(JSON.stringify(markWeak({ 10: 1, 2: 1 }, 5, false))).toBe('{"2":1,"5":1,"10":1}')
  })
})

describe('weakCount', () => {
  it('reads own keys only, 0 otherwise', () => {
    expect(weakCount({ 4: 2 }, 4)).toBe(2)
    expect(weakCount({ 4: 2 }, 5)).toBe(0)
  })
})
