// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isLegacyUser, startCourse } from './legacyUser'

describe('startCourse', () => {
  it.each<[unknown, boolean, string | null]>([
    // No course: choice screen, unless pre-course keys exist (old user → kids).
    [null, false, null],
    [null, true, 'kids'],
    // Falsy stored values count as "no course", as in the prototype.
    ['', false, null],
    ['', true, 'kids'],
    [0, true, 'kids'],
    [false, false, null],
    // Chosen course.
    ['adult', false, 'adult'],
    ['adult', true, 'adult'],
    ['kids', false, 'kids'],
    // Any other value opens kids.
    ['Adult', false, 'kids'],
    ['xx', true, 'kids'],
    [1, false, 'kids'],
  ])('course %j, pre-course keys %s → %s', (storedCourse, hasPreCourseKeys, expected) => {
    expect(startCourse({ storedCourse, hasPreCourseKeys })).toBe(expected)
  })
})

describe('isLegacyUser', () => {
  it.each<[unknown, boolean, boolean]>([
    [null, true, true],
    [null, false, false],
    ['kids', true, false],
    ['adult', true, false],
  ])('course %j, pre-course keys %s → %s', (storedCourse, hasPreCourseKeys, expected) => {
    expect(isLegacyUser({ storedCourse, hasPreCourseKeys })).toBe(expected)
  })
})
