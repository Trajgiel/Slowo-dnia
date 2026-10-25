// Safe key-value access to localStorage, as the prototype `store` (materials/project/APP_SPEC.md → "4"),
// plus an in-memory fallback for the session (architecture/react-port/storage.md → "Устройство модуля").
// The only module that touches `localStorage`.

/** The part of the Web Storage API the adapter uses. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface Kv {
  /** Parsed value; `undefined` — no key, or it cannot be read or parsed. */
  get(key: string): unknown
  /** Writes `JSON.stringify(value)`; if storage refuses, the value lives in memory until the session ends. */
  set(key: string, value: unknown): void
  /** The key exists (`getItem(key) !== null`), whatever its value; an error counts as "no". */
  has(key: string): boolean
}

/** `localStorage` of the page; reading the property itself may throw (storage disabled). */
export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createKv(getStorage: () => StorageLike | null = browserStorage): Kv {
  // Values (JSON text) the storage refused to keep; read before the storage.
  const memory = new Map<string, string>()

  const getItem = (key: string): string | null => {
    const fromMemory = memory.get(key)
    if (fromMemory !== undefined) return fromMemory
    try {
      return getStorage()?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  return {
    get(key) {
      const text = getItem(key)
      if (text === null) return undefined
      try {
        return JSON.parse(text) as unknown
      } catch {
        return undefined
      }
    },
    set(key, value) {
      const text = JSON.stringify(value)
      try {
        const storage = getStorage()
        if (!storage) throw new Error('no storage')
        storage.setItem(key, text)
        memory.delete(key)
      } catch {
        memory.set(key, text)
      }
    },
    has(key) {
      return getItem(key) !== null
    },
  }
}
