import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import { applyTheme, THEME_COLOR } from './theme'

function themeColorMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
}

function resetPage(): void {
  delete document.documentElement.dataset.theme
  document.head.innerHTML = '<meta name="theme-color" content="#121826" />'
  localStorage.clear()
}

beforeEach(resetPage)
afterEach(resetPage)

describe('applyTheme', () => {
  it.each(['light', 'dark'] as const)(
    'sets data-theme="%s" on <html> and its theme-color',
    (theme) => {
      applyTheme(theme)
      expect(document.documentElement.dataset.theme).toBe(theme)
      expect(themeColorMeta()?.content).toBe(THEME_COLOR[theme])
    },
  )

  it('switches back and forth without adding meta tags', () => {
    applyTheme('light')
    applyTheme('dark')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
    expect(themeColorMeta()?.content).toBe(THEME_COLOR.light)
  })

  it('creates the theme-color meta tag when the page has none', () => {
    document.head.innerHTML = ''
    applyTheme('light')
    expect(themeColorMeta()?.content).toBe(THEME_COLOR.light)
  })

  it('does not touch localStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    applyTheme('light')
    expect(setItem).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()
  })
})

// The inline script in index.html sets the theme before the first paint (no React yet).
// Here only its rule; "no flash on a slow CPU" is a browser test (qa, Playwright).
describe('theme script in index.html', () => {
  const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '')

  function runThemeScript(): void {
    expect(inline).toHaveLength(1)
    // Runs the page's own inline script text in this jsdom window, as the browser would.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const script = new Function(inline[0] ?? '') as () => void
    script()
  }

  it('places the inline script before the module script', () => {
    expect(indexHtml.indexOf('<script>')).toBeLessThan(indexHtml.indexOf('type="module"'))
  })

  it('sets the light theme when the stored theme is "light"', () => {
    localStorage.setItem('theme', JSON.stringify('light'))
    runThemeScript()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(themeColorMeta()?.content).toBe(THEME_COLOR.light)
  })

  it.each([
    ['no key', null],
    ['"dark"', JSON.stringify('dark')],
    ['"Light"', JSON.stringify('Light')],
    ['light without JSON quotes (broken JSON)', 'light'],
    ['true', 'true'],
    ['an object', '{"theme":"light"}'],
  ])('falls back to dark for %s', (_label, stored) => {
    if (stored !== null) localStorage.setItem('theme', stored)
    document.documentElement.dataset.theme = 'light'
    runThemeScript()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeColorMeta()?.content).toBe(THEME_COLOR.dark)
  })

  it('falls back to dark when localStorage throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(runThemeScript).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
