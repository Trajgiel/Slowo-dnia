import { describe, expect, it } from 'vitest'
import {
  createBackupCode,
  parseBackupCode,
  restoreBackupCode,
  type BackupProgress,
  type ParsedBackupCode,
} from '.'
import { EXPORT_FIXTURES, IMPORT_FIXTURES, type ImportFixture } from './backup.fixtures'

/** The prototype's importCode() outcome in the shape of parseBackupCode(). */
const expectedParse = (prototype: ImportFixture['prototype']): ParsedBackupCode => {
  if (prototype === 'invalid') return { kind: 'invalid' }
  return prototype.progress
    ? { kind: 'progress', course: prototype.course, progress: prototype.progress }
    : { kind: 'empty', course: prototype.course }
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)
/** Date `YYYY-MM-DD` of the n-th day of 2026 (n from 1). */
const day2026 = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10)

describe('createBackupCode', () => {
  it.each(EXPORT_FIXTURES)('matches the prototype character for character: $name', (fixture) => {
    const { course, done, weak, days, code } = fixture
    expect(createBackupCode(course, { done, weak, days })).toBe(code)
  })

  it('does not depend on the order or duplicates of learned words', () => {
    const sorted = createBackupCode('kids', { done: [1, 5, 9], weak: {}, days: [] })
    expect(createBackupCode('kids', { done: [9, 1, 5, 5], weak: {}, days: [] })).toBe(sorted)
  })

  it('uses only base64url characters without "=" padding', () => {
    const code = createBackupCode('adult', {
      done: range(0, 997),
      weak: { '3': 2 },
      days: ['2026-10-26'],
    })
    expect(code).toMatch(/^SD1\.a\.[A-Za-z0-9_-]+$/)
  })
})

describe('parseBackupCode', () => {
  it.each(IMPORT_FIXTURES)('reads the code as the prototype does: $name', ({ code, prototype }) => {
    expect(parseBackupCode(code)).toEqual(expectedParse(prototype))
  })

  it('never throws on a cut or damaged code', () => {
    const code = EXPORT_FIXTURES.find((f) => f.name === 'kids, typical progress')?.code ?? ''
    for (let length = 0; length < code.length; length++) {
      expect(() => parseBackupCode(code.slice(0, length))).not.toThrow()
      expect(() =>
        parseBackupCode(code.slice(0, length) + '!' + code.slice(length + 1)),
      ).not.toThrow()
    }
  })
})

describe('create → parse round trip', () => {
  const cases: { name: string; progress: BackupProgress; restored: BackupProgress }[] = [
    {
      name: 'empty progress',
      progress: { done: [], weak: {}, days: [] },
      restored: { done: [], weak: {}, days: [] },
    },
    {
      name: 'unsorted words with duplicates come back sorted and unique',
      progress: { done: [12, 3, 3, 0], weak: { '3': 1 }, days: ['2026-10-25'] },
      restored: { done: [0, 3, 12], weak: { '3': 1 }, days: ['2026-10-25'] },
    },
    {
      name: 'word 999 and weak counter over 99',
      progress: { done: [999], weak: { '999': 120 }, days: [] },
      restored: { done: [999], weak: { '999': 99 }, days: [] },
    },
    {
      name: 'only the last 60 streak days are kept',
      progress: {
        done: [1],
        weak: {},
        days: range(1, 71).map(day2026),
      },
      restored: {
        done: [1],
        weak: {},
        days: range(11, 71).map(day2026),
      },
    },
  ]

  it.each(cases)('$name', ({ progress, restored }) => {
    for (const course of ['kids', 'adult'] as const) {
      expect(parseBackupCode(createBackupCode(course, progress))).toEqual({
        kind: 'progress',
        course,
        progress: restored,
      })
    }
  })
})

describe('restoreBackupCode', () => {
  const kidsCode = createBackupCode('kids', {
    done: [0, 2],
    weak: { '2': 1 },
    days: ['2026-10-26'],
  })
  const adultCode = createBackupCode('adult', { done: [999], weak: {}, days: [] })

  it('restores a code of the selected course', () => {
    expect(restoreBackupCode(kidsCode, 'kids')).toEqual({
      kind: 'restored',
      progress: { done: [0, 2], weak: { '2': 1 }, days: ['2026-10-26'] },
    })
    expect(restoreBackupCode(adultCode, 'adult')).toEqual({
      kind: 'restored',
      progress: { done: [999], weak: {}, days: [] },
    })
  })

  it('reports a code of the other course without its progress', () => {
    expect(restoreBackupCode(kidsCode, 'adult')).toEqual({ kind: 'otherCourse', course: 'kids' })
    expect(restoreBackupCode(adultCode, 'kids')).toEqual({ kind: 'otherCourse', course: 'adult' })
  })

  it('reports a code without progress inside, whatever its course (as the prototype)', () => {
    const nullPayload = (id: string) => `SD1.${id}.${btoa('null')}`
    expect(restoreBackupCode(nullPayload('k'), 'kids')).toEqual({ kind: 'noProgress' })
    expect(restoreBackupCode(nullPayload('a'), 'kids')).toEqual({ kind: 'noProgress' })
  })

  it.each(['', 'hello', 'SD1.k', 'SD1.x.e30', 'SD1.k.%%%', 'SD1.k.' + btoa('not json')])(
    'reports a code it cannot read: %j',
    (code) => {
      expect(restoreBackupCode(code, 'kids')).toEqual({ kind: 'invalid' })
    },
  )
})
