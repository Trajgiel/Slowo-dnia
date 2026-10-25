import i18next, { type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { defaultNS, resources } from './resources'

export const LANGUAGE = 'ru'

/** A configured i18next instance; resources are inline, so it is ready synchronously. */
export function createI18n(): i18n {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources,
    lng: LANGUAGE,
    fallbackLng: LANGUAGE,
    defaultNS,
    ns: [defaultNS],
    // React escapes values in JSX; escaping here too would double-escape.
    interpolation: { escapeValue: false },
  })
  return instance
}

export { defaultNS, resources }
