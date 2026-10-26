// Reading and writing by meaning, for the store (architecture/react-port/storage.md → "Устройство модуля",
// "«Старый пользователь»"). Reads never write: when to write is the store's decision
// (architecture/react-port/storage.md → "Когда что пишется").
import {
  COURSES,
  QUIZ_DIRS,
  startCourse,
  type CourseId,
  type DayKey,
  type Deck,
  type DeckResult,
  type Done,
  type Gender,
  type QuizDir,
  type QuizMode,
  type Weak,
} from '../domain'
import {
  encodeDeck,
  encodeDeckResult,
  encodeDone,
  encodeWeak,
  parseDays,
  parseDeck,
  parseDeckResult,
  parseDone,
  parseGender,
  parseQuizDir,
  parseQuizMode,
  parseTheme,
  parseWeak,
  type Theme,
} from './codecs'
import { browserStorage, createKv, type StorageLike } from './kv'
import { COURSE_KEYS, KEYS, PRE_COURSE_KEYS, courseKey, deckKey, lastKey, prevKey } from './keys'

/** What "Выучили" and the quiz answers write together (prototype `save()`). */
export interface CourseProgress {
  /** Written sorted ascending without repeats (a restored code may bring an unsorted list). */
  readonly done: Done | readonly number[]
  readonly weak: Weak
  readonly days: readonly DayKey[]
}

export interface StoredCourseState extends CourseProgress {
  readonly done: Done
  readonly gender: Gender
}

export interface DeckResults {
  readonly last: DeckResult | null
  readonly prev: DeckResult | null
}

export interface StorageRepo {
  /**
   * Course to open at start (`domain/legacyUser`): `null` — the course choice. Writes nothing;
   * for `"kids"` the store writes `course = "kids"`.
   */
  readStartCourse(): CourseId | null
  writeCourse(course: CourseId): void

  readTheme(): Theme
  writeTheme(theme: Theme): void
  readQuizMode(): QuizMode
  writeQuizMode(mode: QuizMode): void
  readQuizDir(): QuizDir
  writeQuizDir(dir: QuizDir): void
  /** Last tab: only written, never read at start (materials/project/APP_SPEC.md → "4.1"). */
  writeTab(tab: string): void

  /** Gender, learned words (filtered by the course size), weak words and days of the course. */
  readCourseState(course: CourseId): StoredCourseState
  writeGender(course: CourseId, gender: Gender): void
  /** `done`, `weak`, `days` — all three, as the prototype `save()`. */
  writeProgress(course: CourseId, progress: CourseProgress): void

  /** `null` — no deck or a broken one: the store makes a new deck and writes it. */
  readDeck(course: CourseId, dir: QuizDir): Deck | null
  writeDeck(course: CourseId, dir: QuizDir, deck: Deck): void
  readDeckResults(course: CourseId, dir: QuizDir): DeckResults
  writeLastResult(course: CourseId, dir: QuizDir, result: DeckResult): void
  writePrevResult(course: CourseId, dir: QuizDir, result: DeckResult): void

  /**
   * Restore from a code and progress reset (prototype `writeCourse`): progress, then `deck_`, `last_`,
   * `prev_` of both directions set to `null`.
   */
  replaceCourse(course: CourseId, progress: CourseProgress): void
}

/** Repo over `getStorage()` (the page `localStorage` by default; a fake one in tests). */
export function createRepo(getStorage: () => StorageLike | null = browserStorage): StorageRepo {
  const kv = createKv(getStorage)
  const writeProgress = (course: CourseId, { done, weak, days }: CourseProgress): void => {
    kv.set(courseKey(course, COURSE_KEYS.done), encodeDone(done))
    kv.set(courseKey(course, COURSE_KEYS.weak), encodeWeak(weak))
    kv.set(courseKey(course, COURSE_KEYS.days), [...days])
  }

  return {
    readStartCourse: () =>
      startCourse({
        storedCourse: kv.get(KEYS.course) ?? null,
        hasPreCourseKeys: PRE_COURSE_KEYS.some((key) => kv.has(key)),
      }),
    writeCourse: (course) => {
      kv.set(KEYS.course, course)
    },

    readTheme: () => parseTheme(kv.get(KEYS.theme)),
    writeTheme: (theme) => {
      kv.set(KEYS.theme, theme)
    },
    readQuizMode: () => parseQuizMode(kv.get(KEYS.qmode)),
    writeQuizMode: (mode) => {
      kv.set(KEYS.qmode, mode)
    },
    readQuizDir: () => parseQuizDir(kv.get(KEYS.qdir)),
    writeQuizDir: (dir) => {
      kv.set(KEYS.qdir, dir)
    },
    writeTab: (tab) => {
      kv.set(KEYS.tab, tab)
    },

    readCourseState: (course) => ({
      gender: parseGender(kv.get(courseKey(course, COURSE_KEYS.kid))),
      done: parseDone(kv.get(courseKey(course, COURSE_KEYS.done)), COURSES[course].wordCount),
      weak: parseWeak(kv.get(courseKey(course, COURSE_KEYS.weak))),
      days: parseDays(kv.get(courseKey(course, COURSE_KEYS.days))),
    }),
    writeGender: (course, gender) => {
      kv.set(courseKey(course, COURSE_KEYS.kid), gender)
    },
    writeProgress,

    readDeck: (course, dir) => parseDeck(kv.get(courseKey(course, deckKey(dir)))),
    writeDeck: (course, dir, deck) => {
      kv.set(courseKey(course, deckKey(dir)), encodeDeck(deck))
    },
    readDeckResults: (course, dir) => ({
      last: parseDeckResult(kv.get(courseKey(course, lastKey(dir)))),
      prev: parseDeckResult(kv.get(courseKey(course, prevKey(dir)))),
    }),
    writeLastResult: (course, dir, result) => {
      kv.set(courseKey(course, lastKey(dir)), encodeDeckResult(result))
    },
    writePrevResult: (course, dir, result) => {
      kv.set(courseKey(course, prevKey(dir)), encodeDeckResult(result))
    },

    replaceCourse: (course, progress) => {
      writeProgress(course, progress)
      for (const dir of QUIZ_DIRS) {
        for (const key of [deckKey(dir), lastKey(dir), prevKey(dir)])
          kv.set(courseKey(course, key), null)
      }
    },
  }
}
