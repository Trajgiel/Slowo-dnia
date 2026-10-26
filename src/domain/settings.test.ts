import { describe, expect, it } from 'vitest'
import { isTabName, TAB_NAMES } from './settings'

describe('tabs', () => {
  it('are the prototype tabs in tab bar order', () => {
    expect(TAB_NAMES).toEqual(['word', 'quiz', 'plan', 'help', 'settings'])
  })

  it.each([
    ['quiz', true],
    ['settings', true],
    ['Quiz', false],
    ['', false],
    ['start', false],
    [undefined, false],
  ])('isTabName(%j) → %s', (value, expected) => {
    expect(isTabName(value)).toBe(expected)
  })
})
