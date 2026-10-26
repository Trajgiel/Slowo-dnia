// @vitest-environment node
// Acceptance, SD-7 (domain logic): the domain layer behaves like the prototype's own code on the same
// inputs. The reference is the prototype code itself (src/test/prototype-domain.txt, verbatim
// lines of materials/project/index.html), run by src/test/prototype.ts with the same clock and
// the same random stream as the domain functions. Criteria covered:
// - every function matches the prototype on the same inputs, in particular: a word unmarked
//   "Выучили" before its answer drops out of the deck; a solved deck is not extended; `days` has no
//   duplicates and keeps the last 400; the streak with empty `days`, today marked / not marked;
//   weights and "recent" words in "Без конца" (random walks over all quiz and word actions);
// - marking at 23:30 and 00:30 local time gives different days, in several time zones (DST included);
// - the course to open at start ("old user" without `course`), word list by gender, speech text;
// - domain functions are pure: no DOM, storage, own clock or own randomness.
// Not here: the table tests of each function (src/domain/*.test.ts, developer), the layer rule in
// ESLint (tests/skeleton-lint.acceptance.test.ts), that the reference copy is still verbatim
// (tests/prototype-fixture.acceptance.test.ts), storage keys and formats (SD-9).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  answerDeck,
  deckState,
  deckSummary,
  expandWords,
  markWeak,
  needsNextFree,
  newDeck,
  nextFree,
  nextIdx,
  praiseFor,
  prepareDeck,
  sanitizeDone,
  speechText,
  startCourse,
  streak,
  streakLine,
  toggleLearned,
  type CourseData,
  type Deck,
  type DeckResult,
  type FreeQuizState,
  type QuizDir,
  type Rng,
  type Weak,
  type Word,
  INITIAL_FREE_QUIZ,
} from '.'
import {
  createProto,
  MemoryStorage,
  mulberry32,
  type Proto,
  type RawTheme,
} from '../test/prototype'

// A small kids course: 12 words in 3 themes; the second theme and two words have boy forms.
const THEMES: RawTheme[] = [
  ['Тема A', [0, 1, 2, 3, 4].map((i) => [`pa${String(i)}`, `ra${String(i)}`, `ta${String(i)}`])],
  ['Я готова!', [0, 1, 2, 3].map((i) => [`pb${String(i)}`, `rb${String(i)}`, `tb${String(i)}`])],
  ['Тема C', [0, 1, 2].map((i) => [`pc${String(i)}`, `rc${String(i)}`, `tc${String(i)}`])],
]
const BOY = { pb1: ['pb1-m', 'rb1-m', 'tb1-m'], pc0: ['pc0-m', 'rc0-m', 'tc0-m'] }
const BOY_THEME = { 'Я готова!': 'Я готов!' }
const KIDS: CourseData = {
  id: 'kids',
  themes: THEMES as unknown as Extract<CourseData, { id: 'kids' }>['themes'],
  boy: { words: BOY as never, themes: BOY_THEME },
}
const WORDS: Word[] = expandWords(KIDS, 'girl')
const DIRS: QuizDir[] = ['ru', 'pl']

/** What the app keeps for one course, written the way the prototype writes it. */
class Domain {
  done = new Set<number>()
  weak: Weak = {}
  days: string[] = []
  deck: Partial<Record<QuizDir, Deck>> = {}
  last: Partial<Record<QuizDir, DeckResult>> = {}
  prev: Partial<Record<QuizDir, DeckResult>> = {}
  free: FreeQuizState = INITIAL_FREE_QUIZ

  readonly rng: Rng
  readonly now: () => Date

  constructor(rng: Rng, now: () => Date) {
    this.rng = rng
    this.now = now
  }

  toggle(i: number) {
    const r = toggleLearned(this.done, this.days, i, this.now())
    this.done = r.done
    this.days = r.days
    return r.learned
  }

  /** Opens the deck of `dir` (only called with learned words, as the quiz tab does). */
  openDeck(dir: QuizDir) {
    const p = prepareDeck(this.deck[dir] ?? null, this.done, this.rng)
    if (p.changed) this.deck[dir] = p.deck
    return p.state
  }

  answerDeck(dir: QuizDir, recalled: boolean) {
    const deck = this.deck[dir]
    if (!deck) throw new Error('deck not opened')
    const next = deckState(deck, this.done).next
    if (next === undefined) throw new Error('deck solved')
    const a = answerDeck(deck, this.done, recalled, this.last[dir] ?? null, this.now())
    this.weak = markWeak(this.weak, next, recalled)
    this.deck[dir] = a.deck
    if (a.finished) {
      if (a.finished.prev) this.prev[dir] = a.finished.prev
      this.last[dir] = a.finished.last
    }
  }

  restartDeck(dir: QuizDir) {
    this.deck[dir] = newDeck(this.done, this.rng)
  }

  openFree() {
    if (needsNextFree(this.free, this.done))
      this.free = nextFree(this.free, this.done, this.weak, this.rng)
  }

  answerFree(recalled: boolean | null) {
    const idx = this.free.idx
    if (idx === null) throw new Error('no free word')
    if (recalled !== null) this.weak = markWeak(this.weak, idx, recalled)
    this.free = nextFree(this.free, this.done, this.weak, this.rng)
  }
}

const raw = (s: MemoryStorage, key: string) => s.getItem(key)
const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v))

/** Everything the prototype has written equals what the domain produced. */
function expectSameStore(storage: MemoryStorage, d: Domain) {
  expect(raw(storage, 'done') ?? '[]').toBe(JSON.stringify([...d.done].sort((a, b) => a - b)))
  expect(raw(storage, 'weak') ?? '{}').toBe(JSON.stringify(d.weak))
  expect(raw(storage, 'days') ?? '[]').toBe(JSON.stringify(d.days))
  for (const dir of DIRS) {
    expect(raw(storage, `deck_${dir}`)).toBe(json(d.deck[dir]))
    expect(raw(storage, `last_${dir}`)).toBe(json(d.last[dir]))
    expect(raw(storage, `prev_${dir}`)).toBe(json(d.prev[dir]))
  }
}

function expectSameStreak(proto: Proto, d: Domain) {
  const s = streak(d.days, d.now())
  expect(s).toEqual(proto.streak())
  const el = proto.renderStreak()
  const line = streakLine(d.days, d.now())
  expect(el.hidden).toBe(line.kind === 'hidden')
  if (line.kind === 'start')
    expect(el.textContent).toBe('Отметьте слово сегодня, чтобы начать новую серию 🔥')
  if (line.kind === 'count') {
    expect(el.textContent.startsWith(`🔥 ${String(line.n)} `)).toBe(true)
    expect(el.textContent.includes('чтобы не прервать серию')).toBe(!line.today)
  }
}

/** Text branch of the solved deck in the prototype markup. */
function protoVerdict(box: string) {
  if (box.includes('Без единой ошибки!')) return 'perfect'
  if (box.includes('отличный результат')) return 'great'
  if (box.includes('повторите слова ещё раз')) return 'retry'
  return 'none'
}

interface WalkStats {
  droppedBeforeAnswer: number
  solvedNotExtended: number
  prevWritten: number
  recentCut: number
  weakCapped: number
  praise: number
  freeRefresh: number
}

/**
 * Random walk over the user's actions on "Слово" and "Опрос" (both modes, both directions) with the
 * clock moving forward. After every step the prototype's storage, streak and quiz state are compared
 * with the domain's.
 */
function walk(seed: number, steps: number, start: Date, stats: WalkStats) {
  const act = mulberry32(seed)
  const storage = new MemoryStorage()
  let nowMs = start.getTime()
  const proto = createProto({
    themes: THEMES,
    boy: BOY,
    boyTheme: BOY_THEME,
    storage,
    now: () => nowMs,
    random: mulberry32(seed ^ 0x5eed),
  })
  const d = new Domain(mulberry32(seed ^ 0x5eed), () => new Date(nowMs))
  const pickInt = (n: number) => Math.floor(act() * n)

  for (let step = 0; step < steps; step++) {
    const r = act()
    if (r < 0.35) {
      const i = pickInt(WORDS.length)
      // word unmarked while it is in an unsolved deck and not answered yet → must drop out
      for (const dir of DIRS) {
        const dk = d.deck[dir]
        if (dk && d.done.has(i) && dk.order.includes(i) && !Object.hasOwn(dk.ans, String(i))) {
          if (deckState(dk, d.done).next !== undefined) stats.droppedBeforeAnswer++
        }
      }
      const toasts = proto.toasts.length
      proto.toggle(i)
      const learned = d.toggle(i)
      const praise = learned ? praiseFor(WORDS, d.done, i) : null
      const toast = proto.toasts.slice(toasts)
      if (!praise) expect(toast).toEqual([])
      else {
        stats.praise++
        expect(toast).toEqual([
          praise.kind === 'all'
            ? `🏆 Все ${String(praise.total)} слов выучены! Gratulacje!`
            : `🎉 Тема «${praise.theme}» выучена! Brawo!`,
        ])
      }
    } else if (r < 0.7) {
      const dir = DIRS[pickInt(2)] ?? 'ru'
      proto.vars.quiz.mode = 'deck'
      proto.vars.quiz.dir = dir
      const view = proto.renderQuiz()
      if (!d.done.size) {
        expect(view.box).toContain('Пока нечего спрашивать')
        continue
      }
      const st = d.openDeck(dir)
      expect(st).toEqual(proto.deckState(JSON.parse(raw(storage, `deck_${dir}`) ?? 'null')))
      if (st.next === undefined) {
        const sum = deckSummary(st, d.done.size)
        expect(protoVerdict(view.box)).toBe(sum.verdict)
        expect(view.box.includes(`В новой колоде будет ${String(sum.nextDeckSize)} `)).toBe(
          sum.nextDeckSize !== null,
        )
        if (sum.nextDeckSize !== null) stats.solvedNotExtended++
        if (act() < 0.5) {
          expect(proto.click('qAgain')).toBe(true)
          d.restartDeck(dir)
        }
      } else if (act() < 0.12) {
        const answeredAny = st.right + st.wrong > 0
        expect(proto.click('qRestart')).toBe(answeredAny)
        if (answeredAny) d.restartDeck(dir)
      } else {
        const ok = act() < 0.6
        const lastBefore = d.last[dir]
        expect(proto.click('qShow')).toBe(true)
        expect(proto.click(ok ? 'qYes' : 'qNo')).toBe(true)
        d.answerDeck(dir, ok)
        // the deck got solved over a former result: that result is now the previous one
        if (lastBefore && d.last[dir] !== lastBefore) stats.prevWritten++
      }
    } else if (r < 0.9) {
      proto.vars.quiz.mode = 'free'
      const before = d.free.idx
      proto.renderQuiz()
      if (!d.done.size) continue
      d.openFree()
      if (before !== null && before !== d.free.idx) stats.freeRefresh++
      expect(d.free).toEqual(proto.vars.quiz.free)
      const k = act()
      const recentBefore = d.free.recent.length
      if (k < 0.85) expect(proto.click('qShow')).toBe(true)
      if (k < 0.4) {
        expect(proto.click('qYes')).toBe(true)
        d.answerFree(true)
      } else if (k < 0.85) {
        expect(proto.click('qNo')).toBe(true)
        d.answerFree(false)
      } else {
        expect(proto.click('qSkip')).toBe(true)
        d.answerFree(null)
      }
      if (d.free.recent.length <= recentBefore && recentBefore > 0) stats.recentCut++
      expect(d.free).toEqual(proto.vars.quiz.free)
      if (Object.values(d.weak).some((c) => c > 3)) stats.weakCapped++
    } else {
      // time goes on: up to 20 hours, so midnights (and DST changes) are crossed often
      nowMs += Math.floor(act() * 20 * 3600_000)
    }
    expectSameStore(storage, d)
    expectSameStreak(proto, d)
    expect(nextIdx(d.done, WORDS.length)).toBe(proto.nextIdx())
  }
}

// process.env without Node types in the app's tsconfig; the domain tests run in Node.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env

const TIME_ZONES: [string, number][] = [
  // zone, offset (getTimezoneOffset) on 2026-07-01: proves the zone really switched
  ['Europe/Warsaw', -120],
  ['Pacific/Auckland', -720],
  ['America/Sao_Paulo', 180],
  ['Asia/Kolkata', -330],
  ['UTC', 0],
]

describe.each(TIME_ZONES)('time zone %s', (zone, julyOffset) => {
  const saved = env.TZ
  beforeAll(() => {
    env.TZ = zone
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(julyOffset)
  })
  afterAll(() => {
    if (saved === undefined) delete env.TZ
    else env.TZ = saved
  })

  it('random walks over words, deck and "Без конца" match the prototype step by step', () => {
    const stats: WalkStats = {
      droppedBeforeAnswer: 0,
      solvedNotExtended: 0,
      prevWritten: 0,
      recentCut: 0,
      weakCapped: 0,
      praise: 0,
      freeRefresh: 0,
    }
    // the walk starts the evening before the Warsaw DST change (2026-10-25 03:00)
    for (let seed = 1; seed <= 40; seed++) walk(seed, 250, new Date(2026, 9, 24, 21, 0), stats)
    // the key situations of the criteria really happened in the walks
    for (const [name, count] of Object.entries(stats)) expect(count, name).toBeGreaterThan(0)
  })

  it('marking at 23:30 and at 00:30 local time gives two different days, as in the prototype', () => {
    const storage = new MemoryStorage()
    let nowMs = new Date(2026, 9, 24, 23, 30).getTime()
    const proto = createProto({ themes: THEMES, storage, now: () => nowMs, random: mulberry32(3) })
    const d = new Domain(mulberry32(3), () => new Date(nowMs))
    proto.toggle(0)
    d.toggle(0)
    nowMs = new Date(2026, 9, 25, 0, 30).getTime()
    proto.toggle(1)
    d.toggle(1)
    expect(d.days).toEqual(['2026-10-24', '2026-10-25'])
    expectSameStore(storage, d)
    expect(streak(d.days, d.now())).toEqual({ n: 2, today: true })
    expectSameStreak(proto, d)
    // the day after the DST change: 23:30 on the 25th and 00:30 on the 26th
    nowMs = new Date(2026, 9, 25, 23, 30).getTime()
    proto.toggle(2)
    d.toggle(2)
    nowMs = new Date(2026, 9, 26, 0, 30).getTime()
    proto.toggle(3)
    d.toggle(3)
    expect(d.days).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    expectSameStore(storage, d)
    expect(streak(d.days, d.now())).toEqual({ n: 3, today: true })
    expectSameStreak(proto, d)
    // the deck result of a deck solved at 00:30 carries the new day
    proto.vars.quiz.dir = 'ru'
    for (let k = 0; k < 4; k++) {
      proto.renderQuiz()
      d.openDeck('ru')
      proto.click('qShow')
      proto.click('qYes')
      d.answerDeck('ru', true)
    }
    expect(d.last.ru?.date).toBe('2026-10-26')
    expectSameStore(storage, d)
  })
})

describe('named cases against the prototype', () => {
  function pair(seed = 7, at = new Date(2026, 9, 26, 12, 0)) {
    const storage = new MemoryStorage()
    let nowMs = at.getTime()
    const proto = createProto({
      themes: THEMES,
      boy: BOY,
      boyTheme: BOY_THEME,
      storage,
      now: () => nowMs,
      random: mulberry32(seed),
    })
    const d = new Domain(mulberry32(seed), () => new Date(nowMs))
    return {
      storage,
      proto,
      d,
      setNow(date: Date) {
        nowMs = date.getTime()
      },
      both(i: number) {
        proto.toggle(i)
        d.toggle(i)
      },
      open(dir: QuizDir = 'ru') {
        proto.vars.quiz.mode = 'deck'
        proto.vars.quiz.dir = dir
        const view = proto.renderQuiz()
        return { view, state: d.openDeck(dir) }
      },
      answer(ok: boolean, dir: QuizDir = 'ru') {
        expect(proto.click('qShow')).toBe(true)
        expect(proto.click(ok ? 'qYes' : 'qNo')).toBe(true)
        d.answerDeck(dir, ok)
      },
    }
  }

  it('a word unmarked "Выучили" before its answer drops out of the deck; an answered one stays', () => {
    const p = pair()
    ;[0, 1, 2, 3].forEach((i) => {
      p.both(i)
    })
    const first = p.open().state
    expect(first.total).toBe(4)
    p.answer(true)
    const answered = first.next ?? -1
    const pending = [0, 1, 2, 3].filter((i) => i !== answered)
    p.both(answered) // unmark the answered word: it stays in the score
    p.both(pending[0] ?? -1) // unmark a not answered word: it drops out
    const st = p.open().state
    expect(st).toMatchObject({ total: 3, right: 1, wrong: 0 })
    expectSameStore(p.storage, p.d)
    expect(st).toEqual(p.proto.deckState(JSON.parse(p.storage.getItem('deck_ru') ?? 'null')))
  })

  it('a solved deck is not extended with new learned words; "Решить заново" takes them all', () => {
    const p = pair()
    ;[0, 1].forEach((i) => {
      p.both(i)
    })
    p.open()
    p.answer(true)
    p.open()
    p.answer(false)
    ;[5, 6, 7].forEach((i) => {
      p.both(i)
    })
    const { view, state } = p.open()
    expect(state).toEqual({ total: 2, right: 1, wrong: 1, next: undefined })
    expect(view.box).toContain('В новой колоде будет 5 слов')
    expectSameStore(p.storage, p.d)
    expect(p.proto.click('qAgain')).toBe(true)
    p.d.restartDeck('ru')
    expectSameStore(p.storage, p.d)
    expect(p.open().state.total).toBe(5)
  })

  it('an unsolved deck gets the new learned words appended, in the same shuffled order', () => {
    const p = pair(11)
    ;[0, 1, 2].forEach((i) => {
      p.both(i)
    })
    p.open()
    p.answer(true)
    ;[8, 9, 10, 11].forEach((i) => {
      p.both(i)
    })
    expect(p.open().state.total).toBe(7)
    expectSameStore(p.storage, p.d)
  })

  it('second solved deck: the former result becomes the previous one', () => {
    const p = pair()
    p.both(4)
    p.open()
    p.answer(false)
    p.setNow(new Date(2026, 9, 27, 9, 0))
    p.proto.renderQuiz()
    expect(p.proto.click('qAgain')).toBe(true)
    p.d.restartDeck('ru')
    p.open()
    p.answer(true)
    expect(p.d.prev.ru).toEqual({ right: 0, wrong: 1, total: 1, date: '2026-10-26' })
    expect(p.d.last.ru).toEqual({ right: 1, wrong: 0, total: 1, date: '2026-10-27' })
    expectSameStore(p.storage, p.d)
  })

  it.each([['450 stored days, today already there → kept as stored', 450, true]])(
    'days: %s',
    (_, count, todayThere) => {
      const today = new Date(2026, 9, 26, 12, 0)
      const stored: string[] = []
      for (let k = count - (todayThere ? 1 : 0); k > (todayThere ? -1 : 0); k--) {
        const dt = new Date(today)
        dt.setDate(dt.getDate() - k)
        stored.push(
          `${String(dt.getFullYear())}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
        )
      }
      expect(stored).toHaveLength(count)
      const storage = new MemoryStorage()
      storage.setItem('days', JSON.stringify(stored))
      const proto = createProto({
        themes: THEMES,
        storage,
        now: () => today.getTime(),
        random: Math.random,
      })
      proto.toggle(0)
      const r = toggleLearned(new Set(), stored, 0, today)
      expect(r.days).toEqual(proto.vars.days)
      expect(r.days).toHaveLength(todayThere ? count : 400)
      expect(r.days.at(-1)).toBe('2026-10-26')
      expect(new Set(r.days).size).toBe(r.days.length)
      // unmarking leaves days as they are
      proto.toggle(0)
      expect(toggleLearned(r.done, r.days, 0, today).days).toEqual(proto.vars.days)
    },
  )

  it.each<[string, string[], Date]>([
    ['broken entries', ['', 'x', '2026-10-25', '20261026'], new Date(2026, 9, 26, 23, 30)],
  ])('streak: %s', (_, days, at) => {
    const storage = new MemoryStorage()
    storage.setItem('days', JSON.stringify(days))
    const proto = createProto({
      themes: THEMES,
      storage,
      now: () => at.getTime(),
      random: Math.random,
    })
    const d = new Domain(Math.random, () => at)
    d.days = days
    expectSameStreak(proto, d)
  })
})

describe('start, words and speech against the prototype', () => {
  const PRE_COURSE = ['done', 'days', 'kid', 'theme', 'tab', 'qmode']

  it.each<[string, Record<string, string>]>([
    ['nothing stored', {}],
    ['course kids', { course: '"kids"' }],
    ['course adult', { course: '"adult"' }],
    ['course adult and old keys', { course: '"adult"', done: '[1]' }],
    ['unknown course', { course: '"x"' }],
    ['course a number', { course: '5' }],
    ['course empty string, no old keys', { course: '""' }],
    ['course empty string, old keys', { course: '""', done: '[]' }],
    ['course false, old keys', { course: 'false', tab: '"quiz"' }],
    ['course 0, no old keys', { course: '0' }],
    ['course null, old theme', { course: 'null', theme: '"dark"' }],
    ['course broken JSON, old kid', { course: '{oops', kid: '"boy"' }],
    ...PRE_COURSE.map((k): [string, Record<string, string>] => [
      `old key ${k} only`,
      { [k]: k === 'done' || k === 'days' ? '[]' : '"x"' },
    ]),
    ['old key with an empty value', { qmode: '' }],
    ['only adult keys, no course', { 'adult:done': '[1]' }],
    ['only qdir (not an old-user key)', { qdir: '"pl"' }],
  ])('course to open: %s', (_, stored) => {
    const storage = new MemoryStorage()
    for (const [k, v] of Object.entries(stored)) storage.setItem(k, v)
    const proto = createProto({
      themes: THEMES,
      storage,
      now: () => Date.now(),
      random: Math.random,
    })
    const c = proto.startCourse()
    const protoCourse = !c ? null : c === 'adult' ? 'adult' : 'kids'
    let storedCourse: unknown
    try {
      storedCourse = JSON.parse(storage.getItem('course') ?? 'null')
    } catch {
      storedCourse = null
    }
    const hasPreCourseKeys = PRE_COURSE.some((k) => storage.getItem(k) !== null)
    expect(startCourse({ storedCourse, hasPreCourseKeys })).toBe(protoCourse)
  })

  it.each([
    ['kids', 'girl'],
    ['kids', 'boy'],
    ['adult', 'girl'],
    ['adult', 'boy'],
  ] as const)('word list: %s course, %s', (course, gender) => {
    const adult: RawTheme[] = [
      [
        'Работа',
        [
          ['jestem zmęczony', 'я устал', 'tr-m', ['jestem zmęczona', 'я устала', 'tr-f']],
          ['praca', 'работа', 'pr'],
        ],
      ],
      ['Дом', [['byłem', 'я был', 'b-m', ['byłam', 'я была', 'b-f']]]],
    ]
    const storage = new MemoryStorage()
    storage.setItem(course === 'adult' ? 'adult:kid' : 'kid', JSON.stringify(gender))
    const proto = createProto({
      themes: THEMES,
      boy: BOY,
      boyTheme: BOY_THEME,
      storage,
      now: () => Date.now(),
      random: Math.random,
    })
    if (course === 'adult') {
      proto.setCourse('adult', adult)
      proto.loadState()
    }
    const data: CourseData =
      course === 'kids'
        ? KIDS
        : {
            id: 'adult',
            themes: adult as unknown as Extract<CourseData, { id: 'adult' }>['themes'],
          }
    expect(expandWords(data, gender)).toEqual(proto.vars.DAYS)
  })

  it('stored done is cleaned like the prototype: only integers 0 <= i < N, no duplicates', () => {
    const values = [0, 1, '2', 2.5, -1, 11, 12, null, 3, 3, 1e3, true, { i: 4 }]
    const storage = new MemoryStorage()
    storage.setItem('done', JSON.stringify(values))
    const proto = createProto({
      themes: THEMES,
      storage,
      now: () => Date.now(),
      random: Math.random,
    })
    const ours = sanitizeDone(values, WORDS.length)
    expect([...ours]).toEqual([...proto.vars.done])
    expect(nextIdx(ours, WORDS.length)).toBe(proto.nextIdx())
  })

  it.each([
    'dzień dobry',
    'Dzień dobry…',
    'mama / tata',
    'a/b',
    'x  /  y',
    'jeden\t/\ndwa',
    '…a / b / c…',
  ])('speech text: %j', (text) => {
    const proto = createProto({
      themes: THEMES,
      storage: new MemoryStorage(),
      now: () => Date.now(),
      random: Math.random,
    })
    proto.speak(text)
    expect(proto.spoken).toEqual([speechText(text)])
  })
})

describe('domain functions are pure', () => {
  const sources = Object.entries(
    import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  )

  it('the domain sources are found', () => {
    expect(sources.map(([f]) => f)).toContain('./deck.ts')
  })

  it.each(sources)('%s uses no DOM, storage, own clock or own randomness', (file, source) => {
    const code = source.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
    for (const banned of [
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bdocument\b/,
      /\bwindow\b/,
      /\bnavigator\b/,
      /\bfetch\s*\(/,
      /Math\.random/,
      /Date\.now/,
      /new Date\(\s*\)/,
    ])
      expect(code, `${file}: ${String(banned)}`).not.toMatch(banned)
  })
})
