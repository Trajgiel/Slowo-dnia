// Course metadata, raw course data types and expansion into the flat word list
// (materials/project/APP_SPEC.md → "3. Данные курсов"; prototype `COURSES`, `fillDays`).

export type CourseId = 'kids' | 'adult'
export const COURSE_IDS: readonly CourseId[] = ['kids', 'adult']

export interface CourseMeta {
  /** Prefix of the course's storage keys: kids `""` (historical), adult `"adult:"`. */
  readonly prefix: string
  /** Number of words in the course. */
  readonly wordCount: number
}

export const COURSES: Readonly<Record<CourseId, CourseMeta>> = {
  kids: { prefix: '', wordCount: 500 },
  adult: { prefix: 'adult:', wordCount: 1000 },
}

export function isCourseId(value: unknown): value is CourseId {
  return value === 'kids' || value === 'adult'
}

export function coursePrefix(course: CourseId): string {
  return COURSES[course].prefix
}

/** Gender of the learner. In the adult course `girl` = woman, `boy` = man. */
export type Gender = 'girl' | 'boy'
export const GENDERS: readonly Gender[] = ['girl', 'boy']
export const DEFAULT_GENDER: Gender = 'girl'

export function isGender(value: unknown): value is Gender {
  return value === 'girl' || value === 'boy'
}

/** One form of a word: Polish, Russian translation, transcription. */
export type WordForm = readonly [pl: string, ru: string, tr: string]

/** Kids entry: the base form is feminine (girl); masculine forms are in `KidsBoyForms`. */
export type KidsEntry = WordForm
/** Adult entry: the base form is masculine; a 4th element, if present, is the feminine form. */
export type AdultEntry = WordForm | readonly [pl: string, ru: string, tr: string, female: WordForm]

/** A theme: title and its entries, in course order. */
export type CourseTheme<Entry> = readonly [title: string, entries: readonly Entry[]]

export type KidsCourseData = readonly CourseTheme<KidsEntry>[]
export type AdultCourseData = readonly CourseTheme<AdultEntry>[]

/** Masculine forms of the kids course (prototype `BOY` and `BOY_THEME`), keyed by the girl's Polish text / theme title. */
export interface KidsBoyForms {
  readonly words: Readonly<Record<string, WordForm>>
  readonly themes: Readonly<Record<string, string>>
}

export type CourseData =
  | { readonly id: 'kids'; readonly themes: KidsCourseData; readonly boy: KidsBoyForms }
  | { readonly id: 'adult'; readonly themes: AdultCourseData }

/** A word of the flat list. Its index in the list is the word number that all progress is keyed by. */
export interface Word {
  readonly pl: string
  readonly ru: string
  readonly tr: string
  /** Theme index, from 0. */
  readonly ti: number
  /** Theme title, with the gender applied. */
  readonly theme: string
}

const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined

/**
 * Flat word list in course order for the given gender (prototype `fillDays`).
 * Gender changes only texts: indices and their count stay the same.
 */
export function expandWords(course: CourseData, gender: Gender): Word[] {
  const girl = gender === 'girl'
  const words: Word[] = []
  if (course.id === 'kids') {
    course.themes.forEach(([title, entries], ti) => {
      const theme = (girl ? undefined : own(course.boy.themes, title)) ?? title
      for (const entry of entries) {
        const [pl, ru, tr] = (girl ? undefined : own(course.boy.words, entry[0])) ?? entry
        words.push({ pl, ru, tr, ti, theme })
      }
    })
  } else {
    course.themes.forEach(([title, entries], ti) => {
      for (const entry of entries) {
        const [pl, ru, tr] = (girl ? entry[3] : undefined) ?? entry
        words.push({ pl, ru, tr, ti, theme: title })
      }
    })
  }
  return words
}
