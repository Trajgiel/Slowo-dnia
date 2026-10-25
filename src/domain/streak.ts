// Streak of consecutive days (materials/project/APP_SPEC.md → "6.1" → "Серия дней"; prototype `streak`, `renderStreak`).
import { addDays, dayKey, type DayKey } from './dates'

export interface Streak {
  /** Consecutive days back from today (or from yesterday if today is not marked). */
  readonly n: number
  /** Today is in `days`. */
  readonly today: boolean
}

/** Counts the streak by local dates: if today is not marked, it starts from yesterday. */
export function streak(days: readonly DayKey[], now: Date): Streak {
  const set = new Set(days)
  const today = set.has(dayKey(now))
  let d = today ? now : addDays(now, -1)
  let n = 0
  while (set.has(dayKey(d))) {
    n++
    d = addDays(d, -1)
  }
  return { n, today }
}

/** What the streak line shows; texts and plurals are in the i18n dictionaries. */
export type StreakLine =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'start' }
  | { readonly kind: 'count'; readonly n: number; readonly today: boolean }

/** `days` empty → hidden; streak 0 → "start a new streak"; otherwise the count and whether today is marked. */
export function streakLine(days: readonly DayKey[], now: Date): StreakLine {
  if (!days.length) return { kind: 'hidden' }
  const { n, today } = streak(days, now)
  return n ? { kind: 'count', n, today } : { kind: 'start' }
}
