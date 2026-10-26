// App-wide settings shared by both courses (materials/project/APP_SPEC.md → "4.1. Общие ключи").

/** Color theme; the stored value is `"dark"` or `"light"`. */
export type Theme = 'dark' | 'light'

/**
 * Bottom tabs; the name is also the address (`#/word`, …) and the stored `tab` value
 * (architecture/react-port/routing.md → "Маршруты").
 */
export type TabName = 'word' | 'quiz' | 'plan' | 'help' | 'settings'
export const TAB_NAMES: readonly TabName[] = ['word', 'quiz', 'plan', 'help', 'settings']
/** The tab for an empty or unknown address. */
export const DEFAULT_TAB: TabName = 'word'

export function isTabName(value: unknown): value is TabName {
  return (TAB_NAMES as readonly unknown[]).includes(value)
}
