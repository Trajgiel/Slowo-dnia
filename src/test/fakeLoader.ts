import { vi } from 'vitest'
import { CourseLoadError, type CourseLoadErrorKind, type LoadCourse } from '../data'
import type { CourseData, CourseId } from '../domain'

/** Course data of the right size with placeholder words. */
export const FAKE_KIDS: CourseData = {
  id: 'kids',
  themes: [['Тема', Array.from({ length: 500 }, (_, i) => [`k${String(i)}`, 'р', 'т'] as const)]],
  boy: { words: {}, themes: {} },
}
export const FAKE_ADULT: CourseData = {
  id: 'adult',
  themes: [['Тема', Array.from({ length: 1000 }, (_, i) => [`a${String(i)}`, 'р', 'т'] as const)]],
}

export type AdultOutcome = CourseLoadErrorKind | 'ok' | 'wait'

export interface PendingLoad {
  resolve: () => void
  reject: (kind: CourseLoadErrorKind) => void
}

/**
 * Loader: kids at once; each adult load takes the next outcome of `adult` (the last one repeats):
 * `ok`, an error kind, or `wait` — settled by hand through `pending`.
 */
export function fakeLoader(adult: AdultOutcome[] = ['ok']) {
  const queue = [...adult]
  const pending: PendingLoad[] = []
  const load = vi.fn<LoadCourse>((id: CourseId) => {
    if (id === 'kids') return Promise.resolve(FAKE_KIDS)
    const next = queue.length > 1 ? queue.shift() : queue[0]
    if (next === 'ok') return Promise.resolve(FAKE_ADULT)
    if (next === 'wait') {
      return new Promise<CourseData>((resolve, reject) => {
        pending.push({
          resolve: () => {
            resolve(FAKE_ADULT)
          },
          reject: (kind) => {
            reject(new CourseLoadError(kind, kind))
          },
        })
      })
    }
    return Promise.reject(new CourseLoadError(next ?? 'network', 'failed'))
  })
  return { load, pending }
}
