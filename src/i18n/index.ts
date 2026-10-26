import i18next, { type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { defaultNS, NAMESPACES, resources } from './resources'

export const LANGUAGE = 'ru'

export interface I18nOptions {
  /**
   * Called for a key that is not in the dictionary. Tests pass a handler that throws, so a missing
   * key fails them (architecture/react-port/i18n.md → "Правило «строк нет в разметке»").
   */
  readonly onMissingKey?: (namespace: string, key: string) => void
}

/** A configured i18next instance; resources are inline, so it is ready synchronously. */
export function createI18n(options: I18nOptions = {}): i18n {
  const { onMissingKey } = options
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources,
    lng: LANGUAGE,
    fallbackLng: LANGUAGE,
    defaultNS,
    ns: NAMESPACES,
    // React escapes values in JSX; escaping here too would double-escape.
    interpolation: { escapeValue: false },
    ...(onMissingKey && {
      saveMissing: true,
      missingKeyHandler: (_lngs: readonly string[], namespace: string, key: string) => {
        onMissingKey(namespace, key)
      },
    }),
  })
  return instance
}

export { defaultNS, NAMESPACES, resources, type Namespace } from './resources'
