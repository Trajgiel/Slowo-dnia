import { describe, expect, it } from 'vitest'
import { tabFromPath, tabPath } from './tabPath'

describe('tab paths', () => {
  it.each([
    ['/word', 'word'],
    ['/settings', 'settings'],
    ['/quiz/', 'quiz'],
    ['/', null],
    ['', null],
    ['/Quiz', null],
    ['/quiz/x', null],
    ['/nope', null],
  ])('%j → %j', (path, tab) => {
    expect(tabFromPath(path)).toBe(tab)
  })

  it('round-trips every tab', () => {
    expect(tabFromPath(tabPath('plan'))).toBe('plan')
  })
})
