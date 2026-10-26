// Old prototype addresses → new ones (analyst/features/react-port/us-1-start.md → "Вкладки и адрес";
// analyst/features/react-port/us-11-release.md → "Адрес").
import { describe, expect, it } from 'vitest'
import { migrateLegacyAddress, translateLegacyUrl } from './legacyAddress'

const SITE = 'https://trajgiel.github.io/Slowo-dnia/'

describe('translateLegacyUrl', () => {
  it.each([
    ['#word', '#/word'],
    ['#quiz', '#/quiz'],
    ['#plan', '#/plan'],
    ['#help', '#/help'],
    ['#settings', '#/settings'],
  ])('%s → %s, with and without index.html', (hash, next) => {
    expect(translateLegacyUrl(`${SITE}${hash}`)).toBe(`${SITE}${next}`)
    expect(translateLegacyUrl(`${SITE}index.html${hash}`)).toBe(`${SITE}index.html${next}`)
  })

  it('keeps the query of the page', () => {
    expect(translateLegacyUrl(`${SITE}?utm=1#plan`)).toBe(`${SITE}?utm=1#/plan`)
  })

  it.each(['', '#', '#/', '#/word', '#/quiz', '#Word', '#words', '#word/', '#start', '#/nope'])(
    '%j is not an old address',
    (hash) => {
      expect(translateLegacyUrl(`${SITE}${hash}`)).toBeNull()
      expect(translateLegacyUrl(`${SITE}index.html${hash}`)).toBeNull()
    },
  )
})

describe('migrateLegacyAddress', () => {
  it('replaces the history entry, adding none', () => {
    window.history.replaceState(null, '', '/Slowo-dnia/index.html#quiz')
    const length = window.history.length
    migrateLegacyAddress()
    expect(window.location.pathname).toBe('/Slowo-dnia/index.html')
    expect(window.location.hash).toBe('#/quiz')
    expect(window.history.length).toBe(length)
  })

  it('leaves a new address alone', () => {
    window.history.replaceState(null, '', '/Slowo-dnia/#/plan')
    migrateLegacyAddress()
    expect(window.location.hash).toBe('#/plan')
  })
})
