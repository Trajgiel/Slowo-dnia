// "Forgotten" words: word index → count (prototype `markWeak`; materials/project/APP_SPEC.md → "4.2", "6.2").

/** Word index (as an object key, as in JSON) → how many more times it was forgotten than recalled. */
export type Weak = Readonly<Record<string, number>>

/** Count of a word, 0 if it is not in `weak`. */
export function weakCount(weak: Weak, index: number): number {
  return Object.hasOwn(weak, String(index)) ? (weak[String(index)] ?? 0) : 0
}

/**
 * Answer in the quiz: "Не вспомнили" (`recalled = false`) adds 1 (no upper cap, as in the prototype);
 * "Ответили" subtracts 1 and removes the entry at 0. Returns a new object; the input is not changed.
 */
export function markWeak(weak: Weak, index: number, recalled: boolean): Weak {
  const key = String(index)
  const count = weakCount(weak, index)
  const next: Record<string, number> = { ...weak }
  if (recalled) {
    if (count) {
      if (count - 1) next[key] = count - 1
      else Reflect.deleteProperty(next, key)
    }
  } else {
    next[key] = count + 1
  }
  return next
}
