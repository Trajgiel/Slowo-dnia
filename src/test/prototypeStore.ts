// Reference copy of the prototype's storage code (workspace materials/project/index.html: `store`,
// `loadState`, `save`, `getDeck`, the deck-solved write in `renderDeck`, `writeCourse`, the start-up IIFE),
// for acceptance tests that compare the new storage with the prototype on the same `localStorage`.
// Kept line for line with the prototype logic; do not "fix" it — the point is to behave as the prototype.
// Course data loading and rendering are left out: only what reads and writes `localStorage`.

export type ProtoCourse = 'kids' | 'adult'

const PREFIX: Record<ProtoCourse, string> = { kids: '', adult: 'adult:' }
/** N of each course (prototype: `DAYS.length` after `fillDays`). */
const N: Record<ProtoCourse, number> = { kids: 500, adult: 1000 }

/** Prototype `store`. */
export function protoStore(ls: Storage) {
  return {
    get(k: string, d: unknown): unknown {
      try {
        const v = ls.getItem(k)
        return v == null ? d : JSON.parse(v)
      } catch {
        return d
      }
    },
    set(k: string, v: unknown): void {
      try {
        ls.setItem(k, JSON.stringify(v))
      } catch {
        /* ignored, as in the prototype */
      }
    },
  }
}

/** Start-up IIFE: the course the prototype opens (`null` — course choice); `"adult"` assumed loaded. */
export function protoStartCourse(ls: Storage): ProtoCourse | null {
  const store = protoStore(ls)
  let c = store.get('course', null)
  if (!c && ['done', 'days', 'kid', 'theme', 'tab', 'qmode'].some((k) => ls.getItem(k) !== null))
    c = 'kids'
  if (!c) return null
  if (c === 'adult') {
    store.set('course', 'adult')
    return 'adult'
  }
  store.set('course', 'kids')
  return 'kids'
}

export interface ProtoState {
  kid: unknown
  /** `girl = kid === "girl"` in `fillDays`: girl / woman forms. */
  girlForms: boolean
  done: Set<number>
  weak: unknown
  days: unknown
}

/** `loadState` (may throw, as the prototype does on some broken values). */
export function protoLoadState(ls: Storage, course: ProtoCourse): ProtoState {
  const store = protoStore(ls)
  const K = (k: string) => PREFIX[course] + k
  const kid = store.get(K('kid'), 'girl')
  const raw = store.get(K('done'), []) as unknown[]
  const done = new Set(
    raw.filter((i) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < N[course]),
  ) as Set<number>
  const weak = store.get(K('weak'), {})
  const days = store.get(K('days'), [])
  return { kid, girlForms: kid === 'girl', done, weak, days }
}

/** `save()`. */
export function protoSave(
  ls: Storage,
  course: ProtoCourse,
  done: Set<number>,
  weak: Record<string, number>,
  days: string[],
): void {
  const store = protoStore(ls)
  const K = (k: string) => PREFIX[course] + k
  store.set(
    K('done'),
    [...done].sort((a, b) => a - b),
  )
  store.set(K('weak'), weak)
  store.set(K('days'), days)
}

/** `getDeck`: the deck and whether the prototype replaced it with a new one (and wrote it). */
export function protoGetDeck(
  ls: Storage,
  course: ProtoCourse,
  dir: 'ru' | 'pl',
  newDeck: () => { order: number[]; ans: Record<string, boolean> },
): { deck: unknown; replaced: boolean } {
  const store = protoStore(ls)
  const key = PREFIX[course] + 'deck_' + dir
  const dk = store.get(key, null) as { order?: unknown; ans?: unknown } | null
  if (!dk || !Array.isArray(dk.order) || !dk.ans || typeof dk.ans !== 'object') {
    const fresh = newDeck()
    store.set(key, fresh)
    return { deck: fresh, replaced: true }
  }
  return { deck: dk, replaced: false }
}

/** Store the deck after an answer (`store.set(K("deck_"+dir),dk)`). */
export function protoSetDeck(
  ls: Storage,
  course: ProtoCourse,
  dir: 'ru' | 'pl',
  dk: unknown,
): void {
  protoStore(ls).set(PREFIX[course] + 'deck_' + dir, dk)
}

/** Results as `renderDeck` reads them. */
export function protoResults(
  ls: Storage,
  course: ProtoCourse,
  dir: 'ru' | 'pl',
): { last: unknown; prev: unknown } {
  const store = protoStore(ls)
  return {
    last: store.get(PREFIX[course] + 'last_' + dir, null),
    prev: store.get(PREFIX[course] + 'prev_' + dir, null),
  }
}

/** The deck got solved: `if(last)store.set(prev,last);store.set(last,{right,wrong,total,date})`. */
export function protoDeckSolved(
  ls: Storage,
  course: ProtoCourse,
  dir: 'ru' | 'pl',
  s2: { right: number; wrong: number; total: number },
  date: string,
): void {
  const store = protoStore(ls)
  const K = (k: string) => PREFIX[course] + k
  const last = store.get(K('last_' + dir), null)
  if (last) store.set(K('prev_' + dir), last)
  store.set(K('last_' + dir), { right: s2.right, wrong: s2.wrong, total: s2.total, date })
}

/** `writeCourse` (restore from a code, progress reset). */
export function protoWriteCourse(
  ls: Storage,
  c: ProtoCourse,
  x: { done: number[]; weak: Record<string, number>; days: string[] },
): void {
  const store = protoStore(ls)
  const p = PREFIX[c]
  store.set(
    p + 'done',
    [...new Set(x.done)].sort((a, b) => a - b),
  )
  store.set(p + 'weak', x.weak)
  store.set(p + 'days', x.days)
  ;['ru', 'pl'].forEach((d) => {
    ;['deck_', 'last_', 'prev_'].forEach((k) => {
      store.set(p + k + d, null)
    })
  })
}

/** Quiz settings and theme as the prototype reads them (`quiz.mode`, `quiz.dir`, `setTheme`). */
export function protoSettings(ls: Storage): { mode: unknown; dir: unknown; light: boolean } {
  const store = protoStore(ls)
  return {
    mode: store.get('qmode', 'deck'),
    dir: store.get('qdir', 'ru'),
    light: store.get('theme', 'dark') === 'light',
  }
}

/** Theme, mode, direction, gender and tab buttons: `store.set(<key>, <value>)`. */
export function protoSetSetting(ls: Storage, key: string, value: string): void {
  protoStore(ls).set(key, value)
}

/** All keys and their raw text. */
export function snapshot(ls: Storage): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i)
    if (k !== null) out[k] = ls.getItem(k) ?? ''
  }
  return out
}
