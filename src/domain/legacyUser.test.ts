// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isLegacyUser, startCourse } from './legacyUser'

describe('startCourse', () => {
  it.each<[unknown, boolean, string | null]>([
    // No course (also an empty value): choice screen, unless pre-course keys exist (old user → kids).
    [null, false, null],
    [null, true, 'kids'],
    ['', false, null],
    ['', true, 'kids'],
    // Chosen course.
    ['adult', false, 'adult'],
    ['adult', true, 'adult'],
    // Any other value opens kids.
    ['xx', false, 'kids'],
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
