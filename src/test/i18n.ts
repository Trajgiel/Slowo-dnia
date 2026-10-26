import { createI18n } from '../i18n'

/** i18n for tests: a key missing from the `ru` dictionary throws, so the test fails. */
export const createStrictI18n = () =>
  createI18n({
    onMissingKey: (ns, key) => {
      throw new Error(`Missing i18n key ${ns}:${key}`)
    },
  })
