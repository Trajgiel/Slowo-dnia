// The only place with the names of the storage keys (materials/project/APP_SPEC.md → "4.1. Общие ключи",
// "4.2. Ключи курса"; architecture/react-port/storage.md → "Устройство модуля"). Names and prefixes are
// the prototype's and never change: users keep their progress.
import { coursePrefix, type CourseId, type QuizDir } from '../domain'

/** Keys shared by both courses. */
export const KEYS = {
  course: 'course',
  theme: 'theme', // also read by the inline theme script in index.html (before modules load)
  qmode: 'qmode',
  qdir: 'qdir',
  tab: 'tab',
} as const

/** Keys of a course without the prefix (besides the per-direction ones below). */
export const COURSE_KEYS = {
  done: 'done',
  weak: 'weak',
  days: 'days',
  kid: 'kid',
} as const

/** Keys of a course, without the course prefix. */
export type CourseKeyName =
  | (typeof COURSE_KEYS)[keyof typeof COURSE_KEYS]
  | `deck_${QuizDir}`
  | `last_${QuizDir}`
  | `prev_${QuizDir}`

/** Course key: prefix (`""` kids, `"adult:"` adult) + name, e.g. `done`, `adult:deck_pl`. */
export function courseKey(course: CourseId, name: CourseKeyName): string {
  return coursePrefix(course) + name
}

export const deckKey = (dir: QuizDir): CourseKeyName => `deck_${dir}`
export const lastKey = (dir: QuizDir): CourseKeyName => `last_${dir}`
export const prevKey = (dir: QuizDir): CourseKeyName => `prev_${dir}`

/**
 * Keys without prefix whose presence marks an "old user" from before courses (prototype start-up code;
 * materials/project/APP_SPEC.md → "4.3"). Adult keys and `qdir` are not in the list.
 */
export const PRE_COURSE_KEYS: readonly string[] = [
  COURSE_KEYS.done,
  COURSE_KEYS.days,
  COURSE_KEYS.kid,
  KEYS.theme,
  KEYS.tab,
  KEYS.qmode,
]
