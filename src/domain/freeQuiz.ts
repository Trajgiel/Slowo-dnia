// Quiz "Без конца" mode (materials/project/APP_SPEC.md → "6.2" → "Режим «Без конца»"; prototype `pick`, `nextFree`).
import type { QuizDir } from './deck'
import type { Done } from './progress'
import type { Rng } from './random'
import { weakCount, type Weak } from './weak'

/** Session state of the mode; it is not stored between launches. */
export interface FreeQuizState {
  /** Current word; `null` — none yet. */
  readonly idx: number | null
  readonly dir: QuizDir
  /** Recently shown words, oldest first. */
  readonly recent: readonly number[]
}

export const INITIAL_FREE_QUIZ: FreeQuizState = { idx: null, dir: 'ru', recent: [] }

/** Weight of a word: `1 + min(3, weak) * 2`. */
export function freeWeight(weak: number): number {
  return 1 + Math.min(3, weak) * 2
}

/** How many recent words are not repeated: `min(10, floor(done / 2))`. */
export function recentLimit(doneCount: number): number {
  return Math.min(10, Math.floor(doneCount / 2))
}

/**
 * Weighted random learned word; recent ones are skipped if anything else is left.
 * `null` if nothing is learned. Uses one `rng()` call.
 */
export function pickFree(
  done: Done,
  weak: Weak,
  recent: readonly number[],
  rng: Rng,
): number | null {
  const pool = [...done]
  if (!pool.length) return null
  const fresh = pool.filter((i) => !recent.includes(i))
  const base = fresh.length ? fresh : pool
  const bag: number[] = []
  for (const i of base) {
    const k = freeWeight(weakCount(weak, i))
    for (let j = 0; j < k; j++) bag.push(i)
  }
  return bag[Math.floor(rng() * bag.length)] ?? null
}

/**
 * Next question: a word (`pickFree`), then a random direction (50/50), then the word goes to `recent`,
 * whose oldest entry drops out when it gets longer than `recentLimit`. Calls `rng()` twice when there
 * are learned words; without learned words, once (for the direction).
 */
export function nextFree(state: FreeQuizState, done: Done, weak: Weak, rng: Rng): FreeQuizState {
  const idx = pickFree(done, weak, state.recent, rng)
  const dir: QuizDir = rng() < 0.5 ? 'ru' : 'pl'
  if (idx === null) return { idx, dir, recent: state.recent }
  const recent = [...state.recent, idx]
  if (recent.length > recentLimit(done.size)) recent.shift()
  return { idx, dir, recent }
}

/** The current word is missing or no longer learned → a new question is needed. */
export function needsNextFree(state: FreeQuizState, done: Done): boolean {
  return state.idx === null || !done.has(state.idx)
}
