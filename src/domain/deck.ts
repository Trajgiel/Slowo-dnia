// Quiz deck mode (materials/project/APP_SPEC.md → "6.2" → "Режим «Колода»";
// prototype `newDeck`, `getDeck`, `deckState`, `renderDeck`).
import { dayKey, type DayKey } from './dates'
import type { Done } from './progress'
import { shuffle, type Rng } from './random'

export type QuizMode = 'deck' | 'free'
export const QUIZ_MODES: readonly QuizMode[] = ['deck', 'free']
export const DEFAULT_QUIZ_MODE: QuizMode = 'deck'

/** Deck direction: `ru` — Russian → Polish, `pl` — Polish → Russian. */
export type QuizDir = 'ru' | 'pl'
export const QUIZ_DIRS: readonly QuizDir[] = ['ru', 'pl']
export const DEFAULT_QUIZ_DIR: QuizDir = 'ru'

export function isQuizMode(value: unknown): value is QuizMode {
  return value === 'deck' || value === 'free'
}

export function isQuizDir(value: unknown): value is QuizDir {
  return value === 'ru' || value === 'pl'
}

/** Stored deck, field order as in the prototype: `{ order, ans }`. `ans` keys are word indices. */
export interface Deck {
  readonly order: readonly number[]
  readonly ans: Readonly<Record<string, boolean>>
}

/** Result of a solved deck, field order as in the prototype: `{ right, wrong, total, date }`. */
export interface DeckResult {
  readonly right: number
  readonly wrong: number
  readonly total: number
  readonly date: DayKey
}

export interface DeckState {
  /** Words still in the deck: learned, or already answered. */
  readonly total: number
  readonly right: number
  readonly wrong: number
  /** Next unanswered word; `undefined` — the deck is solved. */
  readonly next: number | undefined
}

const answered = (deck: Deck, i: number): boolean => Object.hasOwn(deck.ans, String(i))

/** New deck: all learned words shuffled, no answers. */
export function newDeck(done: Done, rng: Rng): Deck {
  return { order: shuffle([...done], rng), ans: {} }
}

/** Deck counters. A word unmarked "Выучили" before it was answered drops out; an answered one stays. */
export function deckState(deck: Deck, done: Done): DeckState {
  const live = deck.order.filter((i) => done.has(i) || answered(deck, i))
  return {
    total: live.length,
    right: live.filter((i) => deck.ans[String(i)] === true).length,
    wrong: live.filter((i) => deck.ans[String(i)] === false).length,
    next: live.find((i) => !answered(deck, i)),
  }
}

export function isSolved(state: DeckState): boolean {
  return state.next === undefined
}

export interface PreparedDeck {
  readonly deck: Deck
  readonly state: DeckState
  /** The deck differs from the stored one and must be written (prototype writes at the same moment). */
  readonly changed: boolean
}

/**
 * The deck to show when the quiz opens (prototype `getDeck` + start of `renderDeck`; call it only when
 * there are learned words):
 * - no (or broken, i.e. `null`) deck → new deck;
 * - no words left in it → new deck;
 * - not solved and new learned words appeared → they are appended shuffled;
 * - a solved deck is never extended.
 */
export function prepareDeck(stored: Deck | null, done: Done, rng: Rng): PreparedDeck {
  let deck = stored
  let changed = false
  if (!deck) {
    deck = newDeck(done, rng)
    changed = true
  }
  let state = deckState(deck, done)
  if (!state.total) {
    deck = newDeck(done, rng)
    changed = true
    state = deckState(deck, done)
  } else if (state.next !== undefined) {
    const order = deck.order
    const extra = shuffle(
      [...done].filter((i) => !order.includes(i)),
      rng,
    )
    if (extra.length) {
      deck = { order: [...order, ...extra], ans: deck.ans }
      changed = true
      state = deckState(deck, done)
    }
  }
  return { deck, state, changed }
}

export interface DeckFinished {
  /** New last result: counters of the solved deck and today's local date. */
  readonly last: DeckResult
  /** Former last result to write as previous; `null` — there was none, previous stays as is. */
  readonly prev: DeckResult | null
}

export interface DeckAnswer {
  /** `false` — the deck was already solved and the answer was not recorded (nothing to write). */
  readonly answered: boolean
  readonly deck: Deck
  readonly state: DeckState
  /** Set when this answer solved the deck. */
  readonly finished: DeckFinished | null
}

/**
 * Answer the current card (`state.next`). The weak counter is updated separately (`markWeak`).
 * On a solved deck nothing changes.
 */
export function answerDeck(
  deck: Deck,
  done: Done,
  recalled: boolean,
  last: DeckResult | null,
  now: Date,
): DeckAnswer {
  const before = deckState(deck, done)
  if (before.next === undefined) return { answered: false, deck, state: before, finished: null }
  const next: Deck = { order: deck.order, ans: { ...deck.ans, [String(before.next)]: recalled } }
  const state = deckState(next, done)
  const finished =
    state.next === undefined
      ? {
          last: { right: state.right, wrong: state.wrong, total: state.total, date: dayKey(now) },
          prev: last,
        }
      : null
  return { answered: true, deck: next, state, finished }
}

/** Branch of the solved-deck text: 100% — no mistakes, from 80% — great, otherwise — repeat. */
export type DeckVerdict = 'perfect' | 'great' | 'retry'

export interface DeckSummary {
  /** `Math.round(right / total * 100)`. */
  readonly pct: number
  readonly verdict: DeckVerdict
  /** Size of the next deck if more words are learned than are in this one, else `null`. */
  readonly nextDeckSize: number | null
}

/** Solved deck: percent, text branch (🏆 and "Без единой ошибки!" at 100%) and the next deck size note. */
export function deckSummary(state: DeckState, doneCount: number): DeckSummary {
  const pct = state.total ? Math.round((state.right / state.total) * 100) : 0
  const verdict: DeckVerdict = pct === 100 ? 'perfect' : pct >= 80 ? 'great' : 'retry'
  return { pct, verdict, nextDeckSize: doneCount > state.total ? doneCount : null }
}
