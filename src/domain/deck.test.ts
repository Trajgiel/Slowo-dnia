// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { seqRng } from '../test/rng'
import {
  answerDeck,
  deckState,
  deckSummary,
  isQuizDir,
  isQuizMode,
  newDeck,
  prepareDeck,
  type Deck,
  type DeckResult,
} from './deck'

/** rng near 1: shuffle keeps the order, so expected orders are easy to read. */
const keep = seqRng(0.999)
const now = new Date(2026, 9, 26, 23, 30)

describe('newDeck', () => {
  it('shuffles all learned words, no answers', () => {
    expect(newDeck(new Set([1, 2, 3, 4]), seqRng(0, 0.5, 0.99))).toEqual({
      order: [4, 3, 2, 1],
      ans: {},
    })
  })

  it('serializes like the prototype: {"order":…,"ans":…}', () => {
    expect(JSON.stringify(newDeck(new Set([5, 2]), keep))).toBe('{"order":[5,2],"ans":{}}')
  })
})

describe('deckState', () => {
  it.each<[string, Deck, number[], ReturnType<typeof deckState>]>([
    [
      'fresh deck',
      { order: [3, 1, 2], ans: {} },
      [1, 2, 3],
      { total: 3, right: 0, wrong: 0, next: 3 },
    ],
    [
      'answers counted, next is the first unanswered',
      { order: [3, 1, 2], ans: { 3: true, 1: false } },
      [1, 2, 3],
      { total: 3, right: 1, wrong: 1, next: 2 },
    ],
    [
      'unmarked before the answer → drops out',
      { order: [3, 1, 2], ans: { 3: true } },
      [2, 3],
      { total: 2, right: 1, wrong: 0, next: 2 },
    ],
    [
      'unmarked after the answer → stays in the score',
      { order: [3, 1, 2], ans: { 3: true, 1: false } },
      [2],
      { total: 3, right: 1, wrong: 1, next: 2 },
    ],
    [
      'solved: next undefined',
      { order: [1, 2], ans: { 1: true, 2: true } },
      [1, 2],
      { total: 2, right: 2, wrong: 0, next: undefined },
    ],
    [
      'all unmarked, none answered → empty',
      { order: [1, 2], ans: {} },
      [],
      { total: 0, right: 0, wrong: 0, next: undefined },
    ],
  ])('%s', (_, deck, done, state) => {
    expect(deckState(deck, new Set(done))).toEqual(state)
  })
})

describe('prepareDeck', () => {
  it('no deck (missing or broken) → new deck, to be written', () => {
    const r = prepareDeck(null, new Set([1, 2]), keep)
    expect(r.deck).toEqual({ order: [1, 2], ans: {} })
    expect(r.changed).toBe(true)
    expect(r.state.next).toBe(1)
  })

  it('no words left in the deck → new deck', () => {
    const r = prepareDeck({ order: [7, 8], ans: {} }, new Set([1, 2]), keep)
    expect(r.deck).toEqual({ order: [1, 2], ans: {} })
    expect(r.changed).toBe(true)
  })

  it('unsolved deck: new learned words are appended shuffled', () => {
    const stored: Deck = { order: [3, 1], ans: { 3: true } }
    const r = prepareDeck(stored, new Set([1, 3, 5, 6]), seqRng(0))
    expect(r.deck).toEqual({ order: [3, 1, 6, 5], ans: { 3: true } })
    expect(r.state).toEqual({ total: 4, right: 1, wrong: 0, next: 1 })
    expect(r.changed).toBe(true)
    expect(stored.order).toEqual([3, 1])
  })

  it('unsolved deck with nothing new → unchanged, not written', () => {
    const stored: Deck = { order: [3, 1], ans: { 3: true } }
    const r = prepareDeck(stored, new Set([1, 3]), keep)
    expect(r.deck).toBe(stored)
    expect(r.changed).toBe(false)
  })

  it('solved deck is not extended with new words', () => {
    const stored: Deck = { order: [1, 2], ans: { 1: true, 2: false } }
    const r = prepareDeck(stored, new Set([1, 2, 3]), keep)
    expect(r.deck).toBe(stored)
    expect(r.changed).toBe(false)
    expect(r.state.next).toBeUndefined()
  })

  it('a word unmarked before its answer is not re-added while still in order', () => {
    const stored: Deck = { order: [1, 2, 3], ans: { 1: true } }
    const r = prepareDeck(stored, new Set([1, 3]), keep)
    expect(r.changed).toBe(false)
    expect(r.state).toEqual({ total: 2, right: 1, wrong: 0, next: 3 })
  })
})

describe('answerDeck', () => {
  const last: DeckResult = { right: 1, wrong: 1, total: 2, date: '2026-10-20' }

  it('records the answer; deck not solved → no result', () => {
    const deck: Deck = { order: [2, 1], ans: {} }
    const r = answerDeck(deck, new Set([1, 2]), false, last, now)
    expect(r.answered).toBe(true)
    expect(r.deck).toEqual({ order: [2, 1], ans: { 2: false } })
    expect(r.state).toEqual({ total: 2, right: 0, wrong: 1, next: 1 })
    expect(r.finished).toBeNull()
    expect(deck.ans).toEqual({})
  })

  it('last answer: new last result with today, former last becomes previous', () => {
    const r = answerDeck({ order: [2, 1], ans: { 2: false } }, new Set([1, 2]), true, last, now)
    expect(r.finished).toEqual({
      last: { right: 1, wrong: 1, total: 2, date: '2026-10-26' },
      prev: last,
    })
    expect(JSON.stringify(r.finished?.last)).toBe(
      '{"right":1,"wrong":1,"total":2,"date":"2026-10-26"}',
    )
  })

  it('no former last → previous is not written', () => {
    const r = answerDeck({ order: [1], ans: {} }, new Set([1]), true, null, now)
    expect(r.finished).toEqual({
      last: { right: 1, wrong: 0, total: 1, date: '2026-10-26' },
      prev: null,
    })
  })

  it('answer key order follows the prototype (numeric keys ascending)', () => {
    const r = answerDeck({ order: [9, 2], ans: { 9: true } }, new Set([2, 9]), true, null, now)
    expect(JSON.stringify(r.deck)).toBe('{"order":[9,2],"ans":{"2":true,"9":true}}')
  })

  it('solved deck: nothing changes', () => {
    const deck: Deck = { order: [1], ans: { 1: true } }
    const r = answerDeck(deck, new Set([1]), false, last, now)
    expect(r.answered).toBe(false)
    expect(r.deck).toBe(deck)
    expect(r.finished).toBeNull()
  })
})

describe('deckSummary', () => {
  it.each([
    [{ right: 10, wrong: 0, total: 10 }, 10, { pct: 100, verdict: 'perfect', nextDeckSize: null }],
    [{ right: 8, wrong: 2, total: 10 }, 10, { pct: 80, verdict: 'great', nextDeckSize: null }],
    [
      { right: 199, wrong: 1, total: 200 },
      200,
      { pct: 100, verdict: 'perfect', nextDeckSize: null },
    ],
    [{ right: 79, wrong: 21, total: 100 }, 100, { pct: 79, verdict: 'retry', nextDeckSize: null }],
    [{ right: 0, wrong: 3, total: 3 }, 5, { pct: 0, verdict: 'retry', nextDeckSize: 5 }],
    [{ right: 2, wrong: 1, total: 3 }, 2, { pct: 67, verdict: 'retry', nextDeckSize: null }],
  ])('%j, learned %i → %j', (counts, doneCount, summary) => {
    expect(deckSummary({ ...counts, next: undefined }, doneCount)).toEqual(summary)
  })
})

describe('quiz settings guards', () => {
  it.each([
    ['deck', true],
    ['free', true],
    ['ru', false],
  ])('isQuizMode(%j) → %s', (v, ok) => {
    expect(isQuizMode(v)).toBe(ok)
  })

  it.each([
    ['ru', true],
    ['pl', true],
    ['xx', false],
  ])('isQuizDir(%j) → %s', (v, ok) => {
    expect(isQuizDir(v)).toBe(ok)
  })
})
