// @vitest-environment node
// Acceptance, SD-8 (backup code SD1, logic), checked against the prototype's own code, not frozen strings.
// Covers (analyst/features/react-port/us-7-backup-reset.md, "Codes compatibility (main)"; task criteria):
// - a code made by the prototype reads into the same done / weak / days as in the prototype
//   (generated progress of both courses, damaged codes and hand-made payloads, whitespace);
// - a code made by the new version equals the prototype's string for the same stored data;
// - a code made by the new version restores in the prototype (its importCode + writeCourse and the
//   restore button outcome) to the same progress as in the new version, both courses, other course;
// - the frozen fixtures of src/domain/backup/backup.fixtures.ts are what the prototype really gives
//   (they were made by a one-off script that is not in the repository);
// - the vendored prototype block is byte-for-byte the prototype (when its source is reachable).
// The prototype code is tests/fixtures/prototype-sd1.js.txt: lines of index.html of the prototype at
// commit 51cba24 of this repository ("Name the baseline backup code format SD1"), the same file as
// materials/project/index.html in the workspace. It runs in node:vm with an in-memory localStorage.
// Not here: the fixture table itself, round trip, order of words, base64url alphabet and the
// never-throws sweep (src/domain/backup/backup.test.ts); out-of-course words, decks reset, statuses
// and the restore button (SD-17).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createBackupCode,
  parseBackupCode,
  restoreBackupCode,
  type BackupCourseId,
  type ParsedBackupCode,
} from '../src/domain/backup/backup.ts'

// The fixtures module imports './backup' without an extension, which the Node tsconfig of tests/
// rejects; it is loaded untyped and described here.
const FIXTURES_MODULE = ['..', 'src', 'domain', 'backup', 'backup.fixtures.ts'].join('/')
const { EXPORT_FIXTURES, IMPORT_FIXTURES } = (await import(FIXTURES_MODULE)) as {
  EXPORT_FIXTURES: ({ name: string; course: BackupCourseId; code: string } & StoredProgress)[]
  IMPORT_FIXTURES: {
    name: string
    code: string
    prototype: 'invalid' | { course: BackupCourseId; progress: StoredProgress | null }
  }[]
}

const root = fileURLToPath(new URL('..', import.meta.url))
const VENDORED = readFileSync(`${root}tests/fixtures/prototype-sd1.js.txt`, 'utf8')
const PROTOTYPE_COMMIT = '51cba24'
/** Cases alternate between the two courses. */
const courseOf = (n: number): BackupCourseId => (n % 2 === 0 ? 'kids' : 'adult')
const PREFIX: Record<BackupCourseId, string> = { kids: '', adult: 'adult:' }
const SIZE: Record<BackupCourseId, number> = { kids: 500, adult: 1000 }

interface StoredProgress {
  done: number[]
  weak: Record<string, number>
  days: string[]
}

/** The prototype's backup functions, run as they are in a fresh vm context. */
function loadPrototype() {
  const storage = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }
  const context = createContext({ btoa, atob, TextEncoder, TextDecoder, localStorage })
  // `course`, `done`, `weak`, `days` are the prototype's in-memory state (index.html: let course=…).
  runInContext(
    `let course="kids",done,weak,days;\n${VENDORED}\n` +
      `globalThis.api={
        exportCode(c,d,w,s){course=c;done=new Set(d);weak=w;days=s;return exportCode()},
        importCode(code){try{return JSON.stringify(importCode(code))}catch(e){return "threw"}},
        restore(code,c){course=c;let x;try{x=importCode(code)}catch(e){return JSON.stringify({kind:"invalid"})}
          const mine=x[course];
          if(!mine){const other=Object.keys(x).find(k=>x[k]);
            return JSON.stringify(other?{kind:"otherCourse",course:other}:{kind:"noProgress"})}
          writeCourse(course,mine);return JSON.stringify({kind:"restored"})}
      };`,
    context,
  )
  const api = (context as { api: PrototypeApi }).api
  const stored = (course: BackupCourseId): StoredProgress => {
    const read = (key: string): unknown => JSON.parse(storage.get(PREFIX[course] + key) ?? 'null')
    return {
      done: read('done') as number[],
      weak: read('weak') as Record<string, number>,
      days: read('days') as string[],
    }
  }
  return { api, storage, stored }
}

interface PrototypeApi {
  exportCode(course: BackupCourseId, done: number[], weak: unknown, days: string[]): string
  /** JSON of importCode()'s result, or "threw". */
  importCode(code: string): string
  /** The restore button of the prototype (index.html, bkRestore) without the texts: JSON outcome. */
  restore(code: string, course: BackupCourseId): string
}

/** importCode() of the prototype in the shape of parseBackupCode(). */
function prototypeParse(api: PrototypeApi, code: string): ParsedBackupCode {
  const result = api.importCode(code)
  if (result === 'threw') return { kind: 'invalid' }
  const [[course, progress]] = Object.entries(JSON.parse(result) as object) as [
    [BackupCourseId, StoredProgress | null],
  ]
  return progress ? { kind: 'progress', course, progress } : { kind: 'empty', course }
}

/** Deterministic generator (mulberry32): the same cases on every run. */
function random(seed: number) {
  let state = seed
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (max: number) => Math.floor(next() * max)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T
  return { next, int, pick }
}
type Random = ReturnType<typeof random>

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)
const dayOf = (n: number) => new Date(Date.UTC(2025, 0, n)).toISOString().slice(0, 10)

/** Stored progress as the app keeps it: valid word numbers, counters, dates. */
function cleanProgress(rnd: Random, course: BackupCourseId): StoredProgress {
  const size = SIZE[course]
  const done = rnd.pick([
    () => [],
    () => range(0, size),
    () => [size - 1],
    () => [0, 7, 8, 15, 16, size - 1],
    () => range(0, rnd.int(size)).filter(() => rnd.next() < 0.3),
  ])()
  const weak: Record<string, number> = {}
  for (let i = rnd.int(12); i > 0; i--) weak[String(rnd.int(size))] = 1 + rnd.int(150)
  const start = 1 + rnd.int(700)
  const days = range(start, start + rnd.pick([0, 1, 5, 59, 60, 61, 90])).map(dayOf)
  return { done, weak, days }
}

/** Anything that may be in storage: duplicates, unsorted words, odd counters and keys, odd dates. */
function anyProgress(rnd: Random, course: BackupCourseId): StoredProgress {
  const base = cleanProgress(rnd, course)
  const done = [...base.done, ...base.done.slice(0, rnd.int(3))].sort(() => rnd.next() - 0.5)
  const weak: Record<string, number> = { ...base.weak }
  const oddKeys = ['-1', '1.5', 'abc', '', ' 3', '1e2', '00', String(SIZE[course] + 5)]
  const oddCounts = [0, -1, 0.5, 1.5, 99, 100, 1e6, Number.NaN, Number.POSITIVE_INFINITY]
  for (let i = rnd.int(4); i > 0; i--) weak[rnd.pick(oddKeys)] = rnd.pick(oddCounts)
  const days = [...base.days]
  if (rnd.next() < 0.3) days.push(rnd.pick(['2026-1-5', '', 'x', '2026-10-26T00:00', '20261026']))
  return { done, weak, days }
}

/** A prototype-made code changed the way a messenger, a user or a cut copy would change it. */
function damage(rnd: Random, code: string): string {
  const at = rnd.int(code.length + 1)
  const chars = ['!', '=', '+', '/', '.', ' ', '\n', '\t', 'A', 'é', '-', '_', '%']
  return rnd.pick([
    () => code.slice(0, at),
    () => code.slice(0, at) + rnd.pick(chars) + code.slice(at + 1),
    () => code.slice(0, at) + rnd.pick([' ', '\n', '\r\n', '\t', ' ']) + code.slice(at),
    () => code.replace(/^SD1\.[ka]/, `SD1.${rnd.pick(['k', 'a', 'x', 'K', ''])}`),
    () => `${code}${rnd.pick(['=', '==', '.extra', '.', '..'])}`,
    () => code.replace(/-/g, '+').replace(/_/g, '/'),
    () => rnd.pick(['sd1', ' SD1', 'SD2', 'SD1..']) + code.slice(3),
  ])()
}

/** base64url of UTF-8 text, as both versions encode the payload. */
const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

// Payloads the prototype never makes but a pasted code may hold.
const HAND_MADE_PAYLOADS = [
  'null',
  '0',
  '5',
  '"text"',
  '[]',
  '[1,2]',
  '{}',
  'true',
  '{"d":5}',
  '{"d":0,"s":0}',
  '{"d":[1]}',
  '{"d":"!!"}',
  '{"d":"Bw","s":5}',
  '{"d":"Bw","s":["20261026"]}',
  '{"d":"Bw","s":"2026102,20261301,abc,20261026,,20261027 "}',
  '{"d":"Bw","w":[3,4]}',
  '{"d":"Bw","w":"x"}',
  '{"d":"Bw","w":{"1":"5","2":true,"3":[7],"4":null,"5":{},"-0":2,"1e1":3}}',
  '{"d":"Bw==","w":{"0":1},"s":"20261026","x":1}',
  '﻿{"d":"Bw"}',
  '{"d":"Bw","s":"20261026"} ',
  '{"d":"Bw","s":"2026١٠٢٦"}',
]

describe('the vendored prototype code', () => {
  const sources: { name: string; read: () => string | null }[] = [
    {
      name: `git ${PROTOTYPE_COMMIT}:index.html`,
      read: () => {
        const git = spawnSync('git', ['show', `${PROTOTYPE_COMMIT}:index.html`], {
          cwd: root,
          encoding: 'utf8',
        })
        return git.status === 0 ? git.stdout : null
      },
    },
    {
      name: 'workspace materials/project/index.html',
      read: () => {
        const path = `${root}../materials/project/index.html`
        return existsSync(path) ? readFileSync(path, 'utf8') : null
      },
    },
  ]
  // In CI the checkout is shallow and the workspace is absent: the copy is then trusted as committed.
  for (const { name, read } of sources) {
    const original = read()
    it.skipIf(original === null)(`is byte-for-byte the prototype (${name})`, () => {
      const lines = (original ?? '').split('\n')
      const chunks = VENDORED.split(/^\/\/@@ index\.html lines (\d+)-(\d+)\n/m).slice(1)
      expect(chunks.length).toBe(15)
      for (let i = 0; i < chunks.length; i += 3) {
        const [from, to, text] = [Number(chunks[i]), Number(chunks[i + 1]), chunks[i + 2]]
        expect(text).toBe(lines.slice(from - 1, to).join('\n') + '\n')
      }
    })
  }
})

describe('the developer fixtures are what the prototype gives', () => {
  const { api } = loadPrototype()

  it.each(EXPORT_FIXTURES)('exportCode: $name', ({ course, done, weak, days, code }) => {
    expect(api.exportCode(course, done, weak, days)).toBe(code)
  })

  it.each(IMPORT_FIXTURES)('importCode: $name', ({ code, prototype }) => {
    const expected: ParsedBackupCode =
      prototype === 'invalid'
        ? { kind: 'invalid' }
        : prototype.progress
          ? { kind: 'progress', course: prototype.course, progress: prototype.progress }
          : { kind: 'empty', course: prototype.course }
    expect(prototypeParse(api, code)).toEqual(expected)
  })
})

describe('the same stored data gives the same code string as the prototype', () => {
  const { api } = loadPrototype()
  const rnd = random(20261026)
  const cases = range(0, 300).map((n) => {
    const course = courseOf(n)
    return { n, course, progress: anyProgress(rnd, course) }
  })

  it.each(cases)('case $n ($course)', ({ course, progress }) => {
    const { done, weak, days } = progress
    expect(createBackupCode(course, progress)).toBe(api.exportCode(course, done, weak, days))
  })
})

describe('a prototype code reads into what the prototype restores', () => {
  const { api } = loadPrototype()
  const rnd = random(8)
  const made = range(0, 60).map((n) => {
    const course = courseOf(n)
    const { done, weak, days } = anyProgress(rnd, course)
    return api.exportCode(course, done, weak, days)
  })
  const codes = [
    ...made.map((code, n) => ({ name: `made ${String(n)}`, code })),
    ...range(0, 400).map((n) => ({
      name: `damaged ${String(n)}`,
      code: damage(rnd, rnd.pick(made)),
    })),
    ...HAND_MADE_PAYLOADS.flatMap((json) =>
      ['k', 'a'].map((id) => ({ name: `SD1.${id} + ${json}`, code: `SD1.${id}.${encode(json)}` })),
    ),
  ]

  it.each(codes)('$name', ({ code }) => {
    expect(parseBackupCode(code)).toEqual(prototypeParse(api, code))
  })
})

describe('a code of the new version restores in the prototype as in the new version', () => {
  const rnd = random(77)
  const cases = range(0, 80).map((n) => {
    const course = courseOf(n)
    const current = rnd.next() < 0.75 ? course : courseOf(n + 1)
    return { n, course, current, progress: cleanProgress(rnd, course) }
  })

  it.each(cases)(
    'case $n: code of $course restored in $current',
    ({ course, current, progress }) => {
      const code = createBackupCode(course, progress)
      // Messengers break long codes into lines; both versions ignore it.
      const pasted = code.replace(/(.{40})/g, '$1\n')
      const { api, storage, stored } = loadPrototype()
      const inPrototype = JSON.parse(api.restore(pasted, current)) as { kind: string }
      const inNewVersion = restoreBackupCode(pasted, current)

      if (course !== current) {
        // US-7 "Restore": a code of the other course names that course and leaves progress untouched.
        expect(inPrototype).toEqual({ kind: 'otherCourse', course })
        expect(inNewVersion).toEqual({ kind: 'otherCourse', course })
        expect(storage.size).toBe(0)
        return
      }
      // From the requirement: learned words sorted and unique, counters capped at 99, last 60 days.
      const expected: StoredProgress = {
        done: [...new Set(progress.done)].sort((a, b) => a - b),
        weak: Object.fromEntries(
          Object.entries(progress.weak).map(([k, v]) => [k, Math.min(v, 99)]),
        ),
        days: progress.days.slice(-60),
      }
      expect(inPrototype).toEqual({ kind: 'restored' })
      expect(stored(current)).toEqual(expected)
      expect(inNewVersion).toEqual({ kind: 'restored', progress: expected })
    },
  )
})
