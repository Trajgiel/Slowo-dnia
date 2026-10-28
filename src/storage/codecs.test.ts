import { describe, expect, it } from 'vitest'
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
} from './codecs'

const odd = [undefined, null, 1, true, [], {}, 'other', '']

describe('parseTheme: only "light" is light', () => {
  it.each([['light', 'light'], ['dark', 'dark'], ...odd.map((v) => [v, 'dark'])])(
    '%j → %s',
    (value, expected) => {
      expect(parseTheme(value)).toBe(expected)
    },
  )
})

describe('parseQuizMode / parseQuizDir: unknown → default', () => {
  it.each([['deck', 'deck'], ['free', 'free'], ['pl', 'deck'], ...odd.map((v) => [v, 'deck'])])(
    'mode %j → %s',
    (value, expected) => {
      expect(parseQuizMode(value)).toBe(expected)
    },
  )
  it.each([['ru', 'ru'], ['pl', 'pl'], ['free', 'ru'], ...odd.map((v) => [v, 'ru'])])(
    'dir %j → %s',
    (value, expected) => {
      expect(parseQuizDir(value)).toBe(expected)
    },
  )
})

describe('parseGender', () => {
  it.each<[unknown, string]>([
    ['girl', 'girl'],
    ['boy', 'boy'],
    ['Boy', 'boy'],
    [undefined, 'girl'],
    ...odd.filter((v) => v !== undefined).map((v): [unknown, string] => [v, 'boy']),
  ])('%j → %s', (value, expected) => {
    expect(parseGender(value)).toBe(expected)
  })
})

describe('parseDone', () => {
  it.each([
    ['valid', [3, 0, 2], [0, 2, 3]],
    ['non-integers and out of course dropped', [1, 1.5, -1, 10, 9, '2', null, NaN], [1, 9]],
    ['not an array', { 0: 1 }, []],
    ['null', null, []],
    ['missing', undefined, []],
    ['string', '1,2', []],
  ])('%s', (_, value, expected) => {
    expect([...parseDone(value, 10)].sort((a, b) => a - b)).toEqual(expected)
  })
})

describe('parseWeak', () => {
  it.each([
    ['object as is', { 3: 2, 10: 1 }, { 3: 2, 10: 1 }],
    ['non-number counts dropped', { 1: '2', 2: null, 3: 4 }, { 3: 4 }],
    ['array', [1, 2], {}],
    ['null', null, {}],
    ['number', 5, {}],
    ['missing', undefined, {}],
  ])('%s', (_, value, expected) => {
    expect(parseWeak(value)).toEqual(expected)
  })
})

describe('parseDays', () => {
  it.each([
    ['array as is', ['2026-10-25', '2026-10-26'], ['2026-10-25', '2026-10-26']],
    ['non-strings dropped', ['2026-10-25', 20261026, null], ['2026-10-25']],
    ['not an array', '2026-10-25', []],
    ['null', null, []],
  ])('%s', (_, value, expected) => {
    expect(parseDays(value)).toEqual(expected)
  })
})

describe('parseDeck', () => {
  it('valid deck', () => {
    expect(parseDeck({ order: [4, 1], ans: { 4: true } })).toEqual({
      order: [4, 1],
      ans: { 4: true },
    })
  })
  it('bad items of order and ans are dropped', () => {
    expect(parseDeck({ order: [4, '1', null], ans: { 4: false, 1: 'yes' } })).toEqual({
      order: [4],
      ans: { 4: false },
    })
  })
  it.each([
    ['no order', { ans: {} }],
    ['order not an array', { order: '1,2', ans: {} }],
    ['no ans', { order: [1] }],
    ['ans null', { order: [1], ans: null }],
    ['ans not an object', { order: [1], ans: 1 }],
    ['ans an array', { order: [1], ans: [] }],
    ['null', null],
    ['array', [[1], {}]],
    ['missing', undefined],
  ])('%s → null (new deck)', (_, value) => {
    expect(parseDeck(value)).toBeNull()
  })
})

describe('parseDeckResult', () => {
  it('valid, fields in prototype order', () => {
    const parsed = parseDeckResult({ date: '2026-10-26', total: 5, wrong: 1, right: 4 })
    expect(JSON.stringify(parsed)).toBe('{"right":4,"wrong":1,"total":5,"date":"2026-10-26"}')
  })
  it.each([
    ['null', null],
    ['missing', undefined],
    ['string count', { right: '4', wrong: 1, total: 5, date: '2026-10-26' }],
    ['non-string date', { right: 4, wrong: 1, total: 5, date: 7 }],
    ['array', [4, 1, 5]],
  ])('%s → null', (_, value) => {
    expect(parseDeckResult(value)).toBeNull()
  })
})

describe('parseDeckResult: result without a date', () => {
  it('is read as is, without a date (the prototype shows it without a date)', () => {
    expect(parseDeckResult({ right: 3, wrong: 1, total: 4 })).toEqual({
      right: 3,
      wrong: 1,
      total: 4,
    })
    expect(JSON.stringify(encodeDeckResult({ right: 3, wrong: 1, total: 4 }))).toBe(
      '{"right":3,"wrong":1,"total":4}',
    )
  })
})

describe('encoders: JSON text as the prototype writes it', () => {
  it('done: ascending, no repeats', () => {
    expect(JSON.stringify(encodeDone(new Set([10, 2, 1, 33])))).toBe('[1,2,10,33]')
    expect(JSON.stringify(encodeDone([3, 1, 3]))).toBe('[1,3]')
  })
  it('weak: plain object, number keys ascending', () => {
    expect(JSON.stringify(encodeWeak({ 10: 1, 2: 3 }))).toBe('{"2":3,"10":1}')
  })
  it('deck: order, ans', () => {
    expect(JSON.stringify(encodeDeck({ ans: { 12: false, 3: true }, order: [12, 3, 7] }))).toBe(
      '{"order":[12,3,7],"ans":{"3":true,"12":false}}',
    )
  })
  it('result: right, wrong, total, date', () => {
    expect(
      JSON.stringify(encodeDeckResult({ date: '2026-01-02', total: 3, wrong: 0, right: 3 })),
    ).toBe('{"right":3,"wrong":0,"total":3,"date":"2026-01-02"}')
  })
})
