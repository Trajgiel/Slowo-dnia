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
