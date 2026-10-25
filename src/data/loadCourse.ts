// Course loader (architecture/react-port/course-data.md in the workspace, "Загрузчик курса").
// The kids course is in the main bundle; the adult course is a separate hashed JSON file,
// fetched only when needed and kept in memory for the session.
import type { AdultCourseData, CourseData, CourseId } from '../domain'
import adultUrl from './adult.json?url'
import { KIDS_BOY, KIDS_THEMES } from './kidsCourse'

export const ADULT_WORD_COUNT = 1000

/**
 * Why loading failed:
 * - `network` — no response or a server error: retrying may help;
 * - `not-found` — 404: the file of this app version is gone from the site (a tab opened
 *   before a release), only a page reload helps;
 * - `invalid` — the file is not a course of the expected shape.
 */
export type CourseLoadErrorKind = 'network' | 'not-found' | 'invalid'

export class CourseLoadError extends Error {
  readonly kind: CourseLoadErrorKind

  constructor(kind: CourseLoadErrorKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CourseLoadError'
    this.kind = kind
  }
}

const KIDS: CourseData = { id: 'kids', themes: KIDS_THEMES, boy: KIDS_BOY }

const isString = (value: unknown): value is string => typeof value === 'string'

const isForm = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 3 && value.every(isString)

const isAdultEntry = (value: unknown): boolean =>
  Array.isArray(value) &&
  (isForm(value) || (value.length === 4 && isForm(value.slice(0, 3)) && isForm(value[3])))

/** Checks the shape of the adult course: themes `[title, entries]`, entries of 3–4 items, 1000 words. */
export function isAdultCourseData(value: unknown): value is AdultCourseData {
  if (!Array.isArray(value)) return false
  let words = 0
  for (const theme of value) {
    if (!Array.isArray(theme) || theme.length !== 2) return false
    const [title, entries] = theme as unknown[]
    if (!isString(title) || !Array.isArray(entries) || !entries.every(isAdultEntry)) return false
    words += entries.length
  }
  return words === ADULT_WORD_COUNT
}

export interface CourseLoaderOptions {
  /** Address of the adult course file. */
  readonly adultUrl: string
  readonly fetch: typeof fetch
}

export type LoadCourse = (id: CourseId) => Promise<CourseData>

/**
 * Creates a loader with its own session memory. Concurrent calls share one request;
 * a failed load is forgotten, so the next call makes a new request.
 */
export function createCourseLoader(options: CourseLoaderOptions): LoadCourse {
  let adult: Promise<CourseData> | null = null

  async function fetchAdult(): Promise<CourseData> {
    let text: string
    try {
      const response = await options.fetch(options.adultUrl)
      if (response.status === 404) {
        throw new CourseLoadError('not-found', `Adult course file not found: ${options.adultUrl}`)
      }
      if (!response.ok) {
        throw new CourseLoadError('network', `Adult course: HTTP ${String(response.status)}`)
      }
      text = await response.text()
    } catch (error) {
      if (error instanceof CourseLoadError) throw error
      throw new CourseLoadError('network', 'Adult course: request failed', { cause: error })
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new CourseLoadError('invalid', 'Adult course: not JSON', { cause: error })
    }
    if (!isAdultCourseData(data)) {
      throw new CourseLoadError('invalid', 'Adult course: unexpected data shape')
    }
    return { id: 'adult', themes: data }
  }

  return (id) => {
    if (id === 'kids') return Promise.resolve(KIDS)
    if (!adult) {
      const loading = fetchAdult()
      adult = loading
      loading.catch(() => {
        if (adult === loading) adult = null
      })
    }
    return adult
  }
}

/** The app's loader: the adult course file of this build, the browser's `fetch`. */
export const loadCourse: LoadCourse = createCourseLoader({
  adultUrl,
  fetch: (input, init) => fetch(input, init),
})
