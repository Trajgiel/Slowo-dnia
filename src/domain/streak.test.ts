// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { streak, streakLine } from './streak'

const now = new Date(2026, 9, 26, 12, 0) // 2026-10-26

describe('streak', () => {
  it.each<[string, string[], number, boolean, Date?]>([
    ['empty', [], 0, false],
    ['only today', ['2026-10-26'], 1, true],
    ['today and two days before', ['2026-10-24', '2026-10-25', '2026-10-26'], 3, true],
    ['today not marked, yesterday chain', ['2026-10-23', '2026-10-24', '2026-10-25'], 3, false],
    ['gap: neither today nor yesterday', ['2026-10-23', '2026-10-24'], 0, false],
    ['gap inside the chain', ['2026-10-22', '2026-10-24', '2026-10-25', '2026-10-26'], 3, true],
    ['order and duplicates do not matter', ['2026-10-26', '2026-10-25', '2026-10-25'], 2, true],
    ['across a month and year', ['2025-12-31', '2026-01-01'], 2, false, new Date(2026, 0, 2, 9)],
    ['future dates are ignored', ['2026-10-27', '2026-10-28'], 0, false],
  ])('%s', (_, days, n, today, at = now) => {
    expect(streak(days, at)).toEqual({ n, today })
  })

  it('local midnight: 23:30 and 00:30 count as different days', () => {
    const days = ['2026-10-26']
    expect(streak(days, new Date(2026, 9, 26, 23, 30))).toEqual({ n: 1, today: true })
    expect(streak(days, new Date(2026, 9, 27, 0, 30))).toEqual({ n: 1, today: false })
  })

  it('counts through daylight saving changes', () => {
    const days = ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25']
    expect(streak(days, new Date(2026, 2, 30, 0, 30)).n).toBe(3)
    expect(streak(days, new Date(2026, 9, 26, 0, 30))).toEqual({ n: 2, today: false })
  })
})

describe('streakLine', () => {
  it.each([
    [[], { kind: 'hidden' }],
    [['2026-10-01'], { kind: 'start' }],
    [['2026-10-25', '2026-10-26'], { kind: 'count', n: 2, today: true }],
    [['2026-10-25'], { kind: 'count', n: 1, today: false }],
  ])('%j → %j', (days, line) => {
    expect(streakLine(days, now)).toEqual(line)
  })
})
