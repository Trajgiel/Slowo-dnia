import common from './locales/ru/common.json'

export const defaultNS = 'common'

// Dictionaries are bundled into the build (no network loading: offline, no requests).
export const resources = {
  ru: { common },
} as const
