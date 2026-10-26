import { describe, expect, it } from 'vitest'
import { createI18n } from '.'

describe('createI18n', () => {
  it('is ready synchronously in Russian with Russian as the fallback', () => {
    const i18n = createI18n()
    expect(i18n.isInitialized).toBe(true)
    expect(i18n.language).toBe('ru')
    expect(i18n.options.fallbackLng).toEqual(['ru'])
  })

  it('does not escape interpolated values (React escapes them)', () => {
    expect(createI18n().options.interpolation?.escapeValue).toBe(false)
  })
})

describe('missing keys', () => {
  it('are reported to onMissingKey with their namespace', () => {
    const missing: string[] = []
    const i18n = createI18n({ onMissingKey: (ns, key) => missing.push(`${ns}:${key}`) })
    // Typed keys reject a missing one at compile time; the handler is for keys built at run time.
    const t = i18n.t as unknown as (key: string) => string
    t('start:nope')
    t('appName')
    expect(missing).toEqual(['start:nope'])
  })

  it('are not reported without a handler (the app build)', () => {
    expect(createI18n().options.saveMissing).toBe(false)
  })

  it('every dictionary is loaded', () => {
    const i18n = createI18n()
    expect(i18n.t('start:adultFailed.retry')).toBe('Попробовать ещё раз')
  })
})
