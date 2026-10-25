import type { Rng } from '../domain'

/** Deterministic rng: returns `values` in turn, starting over after the last one. */
export function seqRng(...values: number[]): Rng {
  let i = 0
  return () => {
    const v = values[i % values.length] ?? 0
    i++
    return v
  }
}
