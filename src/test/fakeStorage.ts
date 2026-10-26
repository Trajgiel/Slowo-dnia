import type { StorageLike } from '../storage'

export interface FakeStorageOptions {
  /** `getItem` throws (storage unavailable). */
  readonly throwOnRead?: boolean
  /** `setItem` throws (private mode, quota). */
  readonly throwOnWrite?: boolean
}

/** In-memory `localStorage` stand-in; `items` is the raw text of every key, as a browser keeps it. */
export class FakeStorage implements StorageLike {
  readonly items: Map<string, string>
  private readonly options: FakeStorageOptions

  constructor(initial: Record<string, string> = {}, options: FakeStorageOptions = {}) {
    this.items = new Map(Object.entries(initial))
    this.options = options
  }

  getItem(key: string): string | null {
    if (this.options.throwOnRead) throw new DOMException('denied', 'SecurityError')
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.options.throwOnWrite) throw new DOMException('full', 'QuotaExceededError')
    this.items.set(key, value)
  }

  /** All keys and their raw text. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.items)
  }
}
