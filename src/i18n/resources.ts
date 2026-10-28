import common from './locales/ru/common.json'
import help from './locales/ru/help.json'
import plan from './locales/ru/plan.json'
import quiz from './locales/ru/quiz.json'
import start from './locales/ru/start.json'
import word from './locales/ru/word.json'

export const defaultNS = 'common'

// Dictionaries are bundled into the build (no network loading: offline, no requests).
export const resources = {
  ru: { common, help, plan, quiz, start, word },
} as const

export type Namespace = keyof (typeof resources)['ru']
export const NAMESPACES = Object.keys(resources.ru) as Namespace[]
