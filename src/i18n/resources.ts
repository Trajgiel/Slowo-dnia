import common from './locales/ru/common.json'
import start from './locales/ru/start.json'

export const defaultNS = 'common'

// Dictionaries are bundled into the build (no network loading: offline, no requests).
export const resources = {
  ru: { common, start },
} as const

export type Namespace = keyof (typeof resources)['ru']
export const NAMESPACES = Object.keys(resources.ru) as Namespace[]
