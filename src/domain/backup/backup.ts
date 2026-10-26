// Backup code SD1: one course's progress as a short string.
// Format and behaviour: materials/project/APP_SPEC.md, "7. Backup: SD1 code format" in the workspace;
// the reference is the prototype code (materials/project/index.html: toBits, fromBits, cleanWeak,
// packDays, unpackDays, exportCode, importCode). Codes made by the prototype must always restore,
// and a code made here must match the prototype's string character for character.
//
//   SD1.<id>.<payload>
//   id      = "k" (kids) | "a" (adult)
//   payload = base64url(UTF-8(JSON.stringify({ d, w, s }))), no "=" padding
//     d = base64url(bit mask of learned words): bit i (byte i>>3, mask 1<<(i&7)) = word i learned
//     w = weak counters as stored: { "12": 2, ... }
//     s = the last 60 streak days without dashes: "20261024,20261025"

/** Course of a code. Local to this module; matches the course ids of the app. */
export type BackupCourseId = 'kids' | 'adult'

/** Progress of one course as it is stored (`done`, `weak`, `days` keys of the prototype). */
export interface BackupProgress {
  /** Indexes of learned words. */
  readonly done: readonly number[]
  /** Word index → "not remembered" counter. */
  readonly weak: Readonly<Record<string, number>>
  /** Local dates `YYYY-MM-DD` when a word was marked learned. */
  readonly days: readonly string[]
}

/** Progress read from a code: `weak` is cleaned and dates are checked, as in the prototype. */
export interface RestoredProgress {
  /** Learned word indexes, ascending, without duplicates. May include indexes outside the course. */
  done: number[]
  weak: Record<string, number>
  days: string[]
}

/** What a code contains, regardless of the selected course. */
export type ParsedBackupCode =
  | { kind: 'invalid' }
  | { kind: 'empty'; course: BackupCourseId }
  | { kind: 'progress'; course: BackupCourseId; progress: RestoredProgress }

/** What restoring a code into the selected course gives. */
export type BackupRestoreResult =
  | { kind: 'restored'; progress: RestoredProgress }
  /** Not an SD1 code or it cannot be read. */
  | { kind: 'invalid' }
  /** A code of another course: the progress is left untouched. */
  | { kind: 'otherCourse'; course: BackupCourseId }
  /** An SD1 code without progress data inside (for example `null`). */
  | { kind: 'noProgress' }

const PREFIX = 'SD1.'
const CODE_ID: Readonly<Record<BackupCourseId, string>> = { kids: 'k', adult: 'a' }
const COURSE_BY_ID: ReadonlyMap<string, BackupCourseId> = new Map(
  (Object.keys(CODE_ID) as BackupCourseId[]).map((course) => [CODE_ID[course], course]),
)
/** How many last streak days go into a code. */
const DAYS_IN_CODE = 60
const MAX_WEAK = 99
const PACKED_DAY = /^\d{8}$/

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Throws on input that is not base64 (as `atob` does), like the prototype. */
const fromBase64Url = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))

const packDone = (done: readonly number[]): string => {
  const max = done.reduce((acc, index) => Math.max(acc, index), -1)
  const bits = new Uint8Array(Math.ceil((max + 1) / 8))
  for (const index of done) {
    const byte = index >> 3
    // Out-of-range bytes are ignored by the typed array, as in the prototype.
    bits[byte] = (bits[byte] ?? 0) | (1 << (index & 7))
  }
  return toBase64Url(bits)
}

const unpackDone = (packed: string): number[] => {
  const bits = fromBase64Url(packed)
  const done: number[] = []
  for (let index = 0; index < bits.length * 8; index++) {
    if ((bits[index >> 3] ?? 0) & (1 << (index & 7))) done.push(index)
  }
  return done
}

/** Keeps integer indexes ≥ 0 with a counter > 0; the counter is capped at 99. */
const cleanWeak = (weak: unknown): Record<string, number> => {
  const clean: Record<string, number> = {}
  if (weak && typeof weak === 'object') {
    for (const [key, value] of Object.entries(weak)) {
      const index = Number(key)
      const count = Number(value)
      if (Number.isInteger(index) && index >= 0 && count > 0) {
        clean[String(index)] = Math.min(count, MAX_WEAK)
      }
    }
  }
  return clean
}

const packDays = (days: readonly string[]): string =>
  days
    .slice(-DAYS_IN_CODE)
    .map((day) => day.replace(/-/g, ''))
    .join(',')

const unpackDays = (packed: string): string[] =>
  packed
    ? packed
        .split(',')
        .filter((day) => PACKED_DAY.test(day))
        .map((day) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`)
    : []

/** Thrown inside parsing where the prototype would throw; never leaves this module. */
class UnreadableCode extends Error {}

/** As the prototype's `x.d || ""`: any falsy value is empty text, a truthy non-string is unreadable. */
const optionalText = (value: unknown, field: string): string => {
  if (!value) return ''
  if (typeof value !== 'string') throw new UnreadableCode(field)
  return value
}

/** `null` = no progress inside the code; throws `UnreadableCode` / decoding errors. */
const unpackPayload = (payload: unknown): RestoredProgress | null => {
  if (!payload || typeof payload !== 'object') return null
  const { d, w, s } = payload as { d?: unknown; w?: unknown; s?: unknown }
  return {
    done: unpackDone(optionalText(d, 'd')),
    weak: cleanWeak(w),
    days: unpackDays(optionalText(s, 's')),
  }
}

/** Builds the SD1 code of one course; the string is the same as the prototype's for the same data. */
export function createBackupCode(course: BackupCourseId, progress: BackupProgress): string {
  const payload = JSON.stringify({
    d: packDone(progress.done),
    w: progress.weak,
    s: packDays(progress.days),
  })
  return `${PREFIX}${CODE_ID[course]}.${toBase64Url(new TextEncoder().encode(payload))}`
}

/** Reads a code; whitespace (spaces, line breaks) is ignored. Never throws. */
export function parseBackupCode(code: string): ParsedBackupCode {
  const compact = code.replace(/\s+/g, '')
  if (!compact.startsWith(PREFIX)) return { kind: 'invalid' }
  const [, id = '', data] = compact.split('.')
  const course = COURSE_BY_ID.get(id)
  if (!course || !data) return { kind: 'invalid' }
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(data)))
    const progress = unpackPayload(json)
    return progress ? { kind: 'progress', course, progress } : { kind: 'empty', course }
  } catch {
    return { kind: 'invalid' }
  }
}

/** Reads a code for the selected course, with the prototype's outcomes. Never throws. */
export function restoreBackupCode(code: string, current: BackupCourseId): BackupRestoreResult {
  const parsed = parseBackupCode(code)
  switch (parsed.kind) {
    case 'invalid':
      return { kind: 'invalid' }
    case 'empty':
      return { kind: 'noProgress' }
    case 'progress':
      return parsed.course === current
        ? { kind: 'restored', progress: parsed.progress }
        : { kind: 'otherCourse', course: parsed.course }
  }
}
