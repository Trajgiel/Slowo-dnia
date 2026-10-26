// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addDays, dayKey, formatDayMonth } from './dates'

describe('dayKey', () => {
  it.each([
    [new Date(2026, 0, 5, 12), '2026-01-05'],
    [new Date(2026, 11, 31, 23, 59, 59), '2026-12-31'],
    [new Date(2027, 0, 1, 0, 0, 0), '2027-01-01'],
    [new Date(999, 8, 9), '999-09-09'],
  ])('%s → %s (local date, zero-padded month and day)', (date, key) => {
    expect(dayKey(date)).toBe(key)
  })

  it('23:30 and 00:30 local time are different days', () => {
    expect(dayKey(new Date(2026, 9, 26, 23, 30))).toBe('2026-10-26')
    expect(dayKey(new Date(2026, 9, 27, 0, 30))).toBe('2026-10-27')
  })
})

describe('formatDayMonth', () => {
  it.each([
    ['2026-10-26', '26.10'],
    ['2026-01-05', '05.01'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('%s → "%s"', (key, shown) => {
    expect(formatDayMonth(key)).toBe(shown)
  })
})

describe('addDays', () => {
  it.each([
    [new Date(2026, 0, 1, 10), -1, '2025-12-31'],
    [new Date(2028, 2, 1, 0, 30), -1, '2028-02-29'],
    // Days around daylight saving changes stay calendar days.
    [new Date(2026, 2, 30, 0, 30), -1, '2026-03-29'],
    [new Date(2026, 9, 26, 0, 30), -1, '2026-10-25'],
    [new Date(2026, 9, 26, 23, 30), 1, '2026-10-27'],
  ])('%s %+d day → %s', (date, n, key) => {
    expect(dayKey(addDays(date, n))).toBe(key)
  })

  it('does not change the input', () => {
    const d = new Date(2026, 5, 10)
    addDays(d, -3)
    expect(dayKey(d)).toBe('2026-06-10')
  })
})
