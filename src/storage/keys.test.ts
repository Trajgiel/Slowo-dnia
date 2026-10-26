import { describe, expect, it } from 'vitest'
import { COURSE_KEYS, KEYS, PRE_COURSE_KEYS, courseKey, deckKey, lastKey, prevKey } from './keys'

describe('keys (materials/project/APP_SPEC.md → "4.1", "4.2")', () => {
  it('shared keys', () => {
    expect(Object.values(KEYS)).toEqual(['course', 'theme', 'qmode', 'qdir', 'tab'])
  })

  it('course keys: kids without prefix, adult with "adult:"', () => {
    const names = [
      ...Object.values(COURSE_KEYS),
      ...(['ru', 'pl'] as const).flatMap((d) => [deckKey(d), lastKey(d), prevKey(d)]),
    ]
    expect(names.map((n) => courseKey('kids', n))).toEqual([
      'done',
      'weak',
      'days',
      'kid',
      'deck_ru',
      'last_ru',
      'prev_ru',
      'deck_pl',
      'last_pl',
      'prev_pl',
    ])
    expect(names.map((n) => courseKey('adult', n))).toEqual(names.map((n) => `adult:${n}`))
  })

  it('pre-course keys of the "old user"', () => {
    expect(PRE_COURSE_KEYS).toEqual(['done', 'days', 'kid', 'theme', 'tab', 'qmode'])
  })
})
