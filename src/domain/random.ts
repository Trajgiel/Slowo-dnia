/** Source of randomness: returns a number in [0, 1), like `Math.random`. Passed in so tests can be deterministic. */
export type Rng = () => number

/**
 * Fisher-Yates shuffle in place, the same walk as the prototype (`shuffle` in materials/project/index.html):
 * from the last element down, swap with `floor(rng() * (i + 1))`. Returns the same array.
 */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = items[i] as T
    items[i] = items[j] as T
    items[j] = a
  }
  return items
}
