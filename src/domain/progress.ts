// Learned words, the "Выучили" toggle, percent, theme counts and praise
// (materials/project/APP_SPEC.md → "6.1. Слово (главная)"; prototype `nextIdx`, `done.onclick`, `progress`, `praise`).
import type { Word } from './course'
import { dayKey, type DayKey } from './dates'

/** Indices of learned words. */
export type Done = ReadonlySet<number>

/** Most recent days kept in `days`. */
export const MAX_DAYS = 400

/** Stored `done` → set: keeps only integers `0 <= i < wordCount` (prototype `loadState`). */
export function sanitizeDone(values: readonly unknown[], wordCount: number): Set<number> {
  return new Set(
    values.filter(
      (i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < wordCount,
    ),
  )
}

/** First not learned word from the start of the course; if all are learned — the last word. */
export function nextIdx(done: Done, wordCount: number): number {
  for (let i = 0; i < wordCount; i++) if (!done.has(i)) return i
  return wordCount - 1
}

export interface ToggleResult {
  readonly done: Set<number>
  readonly days: DayKey[]
  /** `true` — the word was marked learned now (praise applies), `false` — the mark was removed. */
  readonly learned: boolean
}

/**
 * "Выучили" toggle on word `index`. Unmarking keeps `days` as is. Marking adds today's local date
 * to `days` if it is not there yet and then keeps the last 400. Inputs are not changed.
 */
export function toggleLearned(
  done: Done,
  days: readonly DayKey[],
  index: number,
  now: Date,
): ToggleResult {
  const nextDone = new Set(done)
  if (nextDone.has(index)) {
    nextDone.delete(index)
    return { done: nextDone, days: [...days], learned: false }
  }
  nextDone.add(index)
  const today = dayKey(now)
  const nextDays = days.includes(today) ? [...days] : [...days, today].slice(-MAX_DAYS)
  return { done: nextDone, days: nextDays, learned: true }
}

/** Percent learned: `Math.round(done / N * 100)`; 0 for an empty course. */
export function percentLearned(doneCount: number, wordCount: number): number {
  return wordCount ? Math.round((doneCount / wordCount) * 100) : 0
}

/** Indices of all words of theme `ti`, in order (the theme dots on "Слово"). */
export function themeWordIndices(words: readonly Word[], ti: number): number[] {
  const out: number[] = []
  words.forEach((w, i) => {
    if (w.ti === ti) out.push(i)
  })
  return out
}

export interface ThemeCount {
  readonly ti: number
  readonly theme: string
  readonly done: number
  readonly total: number
  /** All words of the theme are learned. */
  readonly full: boolean
}

/** Learned / total per theme, in theme order (the "План" counters). */
export function themeCounts(words: readonly Word[], done: Done): ThemeCount[] {
  const byTheme = new Map<number, { ti: number; theme: string; done: number; total: number }>()
  words.forEach((w, i) => {
    let t = byTheme.get(w.ti)
    if (!t) {
      t = { ti: w.ti, theme: w.theme, done: 0, total: 0 }
      byTheme.set(w.ti, t)
    }
    t.total++
    if (done.has(i)) t.done++
  })
  return [...byTheme.values()].map((t) => ({ ...t, full: t.done === t.total }))
}

export type Praise =
  | { readonly kind: 'all'; readonly total: number }
  | { readonly kind: 'theme'; readonly theme: string }

/**
 * Praise after marking word `index` learned: all N learned (and only that), or all words of its theme
 * learned, or nothing.
 */
export function praiseFor(words: readonly Word[], done: Done, index: number): Praise | null {
  if (done.size === words.length) return { kind: 'all', total: words.length }
  const word = words[index]
  if (!word) return null
  const t = word.ti
  return words.every((w, k) => w.ti !== t || done.has(k))
    ? { kind: 'theme', theme: word.theme }
    : null
}
