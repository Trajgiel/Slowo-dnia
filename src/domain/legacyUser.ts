// "Old user" — from before courses existed (materials/project/APP_SPEC.md → "4.3"; prototype start-up code).
import type { CourseId } from './course'

export interface StartInput {
  /** Parsed value of the stored course key (`null` if missing or unreadable). */
  readonly storedCourse: unknown
  /**
   * Any of the pre-course keys without prefix exists (done, days, kid, theme, tab, qmode); the key list
   * lives in the storage layer.
   */
  readonly hasPreCourseKeys: boolean
}

/** No course chosen (a falsy value, as in the prototype), but there are pre-course keys. */
export function isLegacyUser({ storedCourse, hasPreCourseKeys }: StartInput): boolean {
  return !storedCourse && hasPreCourseKeys
}

/**
 * Course to open at start: `null` — show the course choice; `"adult"` only for the stored `"adult"`;
 * any other value and an old user — `"kids"` (the caller then writes `course = "kids"`, as the prototype).
 */
export function startCourse(input: StartInput): CourseId | null {
  if (!input.storedCourse) return isLegacyUser(input) ? 'kids' : null
  return input.storedCourse === 'adult' ? 'adult' : 'kids'
}
