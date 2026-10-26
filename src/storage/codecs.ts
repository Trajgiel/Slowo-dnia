// Parsing stored values into domain types and back into the prototype's exact JSON text
// (architecture/react-port/storage.md → "Разбор значений", "Текст значений").
// A value of an unexpected type becomes the default; nothing here writes to storage.
import {
  DEFAULT_GENDER,
  DEFAULT_QUIZ_DIR,
  DEFAULT_QUIZ_MODE,
  isQuizDir,
  isQuizMode,
  sanitizeDone,
  type DayKey,
  type Deck,
  type DeckResult,
  type Done,
  type Gender,
  type QuizDir,
  type QuizMode,
  type Weak,
} from '../domain'

/** Color theme; the stored value is `"dark"` or `"light"`. */
export type Theme = 'dark' | 'light'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Only `"light"` is light; everything else is dark. */
export function parseTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark'
}

/** Unknown value → `"deck"`; the stored key is left as is. */
export function parseQuizMode(value: unknown): QuizMode {
  return isQuizMode(value) ? value : DEFAULT_QUIZ_MODE
}

/** Unknown value → `"ru"`; the stored key is left as is. */
export function parseQuizDir(value: unknown): QuizDir {
  return isQuizDir(value) ? value : DEFAULT_QUIZ_DIR
}

/** Like the prototype (`girl = value === "girl"`): no key → `"girl"`, `"girl"` → girl, anything else → boy. */
export function parseGender(value: unknown): Gender {
  if (value === undefined) return DEFAULT_GENDER
  return value === 'girl' ? 'girl' : 'boy'
}

/** Not an array → empty; elements other than integers `0 <= i < wordCount` are dropped. */
export function parseDone(value: unknown, wordCount: number): Set<number> {
  return Array.isArray(value) ? sanitizeDone(value, wordCount) : new Set()
}

/** Not an object → `{}`; entries whose count is not a number are dropped. */
export function parseWeak(value: unknown): Weak {
  if (!isRecord(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count)) out[key] = count
  }
  return out
}

/** Not an array → `[]`; elements other than strings are dropped. */
export function parseDays(value: unknown): DayKey[] {
  return Array.isArray(value) ? value.filter((d): d is string => typeof d === 'string') : []
}

/**
 * A deck needs an `order` array and an `ans` object (prototype `getDeck`); otherwise `null` —
 * the caller makes a new deck and writes it. Non-number `order` items and non-boolean answers are dropped.
 */
export function parseDeck(value: unknown): Deck | null {
  if (!isRecord(value) || !Array.isArray(value.order) || !isRecord(value.ans)) return null
  const ans: Record<string, boolean> = {}
  for (const [key, answer] of Object.entries(value.ans)) {
    if (typeof answer === 'boolean') ans[key] = answer
  }
  return {
    order: value.order.filter((i): i is number => typeof i === 'number'),
    ans,
  }
}

/** `{ right, wrong, total, date }` with numbers and a date string; otherwise `null`. */
export function parseDeckResult(value: unknown): DeckResult | null {
  if (!isRecord(value)) return null
  const { right, wrong, total, date } = value
  if (typeof right !== 'number' || typeof wrong !== 'number' || typeof total !== 'number')
    return null
  if (typeof date !== 'string') return null
  return encodeDeckResult({ right, wrong, total, date })
}

/** `done` as stored: sorted ascending, no repeats. */
export function encodeDone(done: Done | readonly number[]): number[] {
  return [...new Set(done)].sort((a, b) => a - b)
}

/** A plain object (never a `Map`): integer keys come out ascending in JSON by themselves. */
export function encodeWeak(weak: Weak): Record<string, number> {
  return { ...weak }
}

/** Field order `order, ans`, as the prototype writes it. */
export function encodeDeck(deck: Deck): { order: number[]; ans: Record<string, boolean> } {
  return { order: [...deck.order], ans: { ...deck.ans } }
}

/** Field order `right, wrong, total, date`, as the prototype writes it. */
export function encodeDeckResult(result: DeckResult): DeckResult {
  return { right: result.right, wrong: result.wrong, total: result.total, date: result.date }
}
