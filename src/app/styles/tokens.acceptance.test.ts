// Acceptance, SD-11 (design tokens):
// - token values equal design/system/README.md in the workspace (values of the prototype CSS,
//   materials/project/index.html, unchanged): colors of both themes, fonts, sizes, line heights,
//   letter spacing, spacing, hit heights, radii, borders, shadows, motion, layout;
// - light values are the default (:root), dark ones under :root[data-theme='dark'];
// - colors only from tokens: no color values in styles or code outside tokens.css (except the
//   browser bar color of each theme, which must equal --paper).
// Not here: that the theme is applied before the first paint -> e2e/theme-before-paint.spec.ts;
// applyTheme -> src/platform/theme.test.ts (developer).
// @vitest-environment node
// Files are read from disk: Vitest replaces CSS imports, `?raw` included, with empty strings.
/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { THEME_COLOR } from '../../platform/theme'

const SRC = fileURLToPath(new URL('../..', import.meta.url))
const read = (file: string): string => readFileSync(join(SRC, file), 'utf8')
const tokensCss = read('app/styles/tokens.css')

// design/system/README.md → "Colors": token → [dark, light].
const COLORS: Record<string, readonly [dark: string, light: string]> = {
  '--paper': ['#121826', '#f6f8fc'],
  '--grid': ['#1b2439', '#e1e8f4'],
  '--ink': ['#e7edf8', '#1c2840'],
  '--muted': ['#9aa6be', '#5d6a82'],
  '--margin': ['#ef6b60', '#d8473c'],
  '--accent': ['#86aeff', '#2c66cf'],
  '--card': ['#1a2235', '#ffffff'],
  '--done': ['#5fc58c', '#2f8f5b'],
  '--line': ['#2b3754', '#d3dcec'],
  '--soft': ['#222c44', '#eef3fb'],
}

// design/system/README.md → "Fonts", "Spacing", "Radii", "Borders and outlines", "Shadows",
// "Motion", "Layout and safe area", "Squared paper", "One-off numbers" (hit heights).
const THEME_INDEPENDENT: Record<string, string> = {
  '--f-body': '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
  '--f-hand': '"Caveat", "Comic Sans MS", cursive',
  '--f-mono': 'ui-monospace, Menlo, monospace',
  '--fs-body': '17px',
  '--fs-h1': '2.2rem',
  '--fs-h2': '1.9rem',
  '--fs-word': 'clamp(2rem, 9vw, 2.8rem)',
  '--fs-q': 'clamp(1.8rem, 8vw, 2.5rem)',
  '--fs-q-long': 'clamp(1.4rem, 6vw, 1.9rem)',
  '--fs-result': '2rem',
  '--fs-tr': '1.75rem',
  '--fs-answer': '1.6rem',
  '--fs-sep': '1.6rem',
  '--fs-stat': '1.5rem',
  '--fs-pick': '1.35rem',
  '--fs-answer-long': '1.3rem',
  '--fs-ru': '1.2rem',
  '--fs-sound': '1.15rem',
  '--fs-empty': '1.1rem',
  '--fs-h3': '1.05rem',
  '--fs-seg': '.92rem',
  '--fs-ask': '.9rem',
  '--fs-small': '.85rem',
  '--fs-xs': '.8rem',
  '--fs-stat-label': '.78rem',
  '--fs-badge': '.75rem',
  '--fs-chip': '.72rem',
  '--fs-dot': 'clamp(.56rem, 2.4vw, .85rem)',
  '--lh-tight': '1',
  '--lh-title': '1.1',
  '--lh-word': '1.12',
  '--lh-q': '1.15',
  '--lh-code': '1.4',
  '--lh-body': '1.5',
  '--ls-caps': '.06em',
  '--ls-dot': '-.04em',
  '--space-2': '2px',
  '--space-4': '4px',
  '--space-6': '6px',
  '--space-8': '8px',
  '--space-10': '10px',
  '--space-12': '12px',
  '--space-14': '14px',
  '--space-16': '16px',
  '--space-18': '18px',
  '--space-20': '20px',
  '--space-24': '24px',
  '--hit-36': '36px',
  '--hit-42': '42px',
  '--hit-44': '44px',
  '--hit-48': '48px',
  '--hit-50': '50px',
  '--hit-52': '52px',
  '--radius-card': '18px',
  '--radius-toast': '16px',
  '--radius-control': '14px',
  '--radius-seg': '11px',
  '--radius-sm': '10px',
  '--radius-pill': '99px',
  '--border': '1px solid var(--line)',
  '--border-control': '1.5px solid var(--line)',
  '--border-dashed': '2px dashed var(--line)',
  '--focus-ring': '3px solid var(--accent)',
  '--focus-ring-offset': '2px',
  '--current-ring': '2.5px solid var(--margin)',
  '--current-ring-offset': '1px',
  '--marker': 'inset 3px 0 0 var(--margin)',
  '--margin-line-width': '2px',
  '--margin-line-opacity': '.75',
  '--margin-line-left': '20px',
  '--shadow-card': '0 8px 26px -18px rgba(20,40,80,.45)',
  '--shadow-seg': '0 1px 4px rgba(0,0,0,.18)',
  '--shadow-toast': '0 10px 30px -12px rgba(0,0,0,.5)',
  '--dur-toast': '.25s',
  '--toast-shift': '10px',
  '--dur-bar': '.4s',
  '--press-scale': '.98',
  '--col-max': '640px',
  '--grid-step': '22px',
  '--tabh': '64px',
  '--z-tabs': '20',
  '--z-toast': '25',
  '--z-statusbar': '30',
}

/** Same value, written either way: quotes, spaces, a leading zero. */
function normalize(value: string): string {
  return value
    .replace(/'/g, '"')
    .replace(/\s+/g, '')
    .replace(/(^|[^\d.])0\./g, '$1.')
    .toLowerCase()
}

/** Custom properties of each rule of tokens.css, by selector. */
function rules(css: string): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>()
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector = '', body = ''] of noComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const props = result.get(selector.trim()) ?? new Map<string, string>()
    for (const declaration of body.split(';')) {
      const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(declaration)
      if (match?.[1] && match[2]) props.set(match[1], match[2])
    }
    result.set(selector.trim(), props)
  }
  return result
}

const tokens = rules(tokensCss)
const light = tokens.get(':root') ?? new Map<string, string>()
const dark = tokens.get(":root[data-theme='dark']") ?? new Map<string, string>()

describe('design tokens (tokens.css)', () => {
  it('has only two rules: :root (light and common values) and the dark theme', () => {
    expect([...tokens.keys()].sort()).toEqual([':root', ":root[data-theme='dark']"])
  })

  it.each(Object.entries(COLORS).map(([name, [d, l]]) => [name, d, l] as const))(
    '%s: dark %s, light %s',
    (name, darkValue, lightValue) => {
      expect(normalize(dark.get(name) ?? '')).toBe(normalize(darkValue))
      expect(normalize(light.get(name) ?? '')).toBe(normalize(lightValue))
    },
  )

  it('the dark theme overrides only the colors, and color-scheme follows the theme', () => {
    expect([...dark.keys()].sort()).toEqual(Object.keys(COLORS).sort())
    const colorScheme = (selector: string): string | undefined =>
      /color-scheme\s*:\s*(\w+)/.exec(
        tokensCss.slice(tokensCss.indexOf(`${selector} {`)).split('}')[0] ?? '',
      )?.[1]
    expect(colorScheme(':root')).toBe('light')
    expect(colorScheme(":root[data-theme='dark']")).toBe('dark')
  })

  it.each(Object.entries(THEME_INDEPENDENT))('%s is %s', (name, value) => {
    expect(normalize(light.get(name) ?? '')).toBe(normalize(value))
  })

  it('declares no tokens beyond the design system', () => {
    const known = new Set([...Object.keys(COLORS), ...Object.keys(THEME_INDEPENDENT)])
    expect([...light.keys()].filter((name) => !known.has(name))).toEqual([])
  })

  it('the browser bar color of each theme equals its --paper', () => {
    expect(THEME_COLOR).toEqual({ dark: COLORS['--paper']?.[0], light: COLORS['--paper']?.[1] })
  })
})

// Color values written by hand: #hex, color functions and common named colors.
// `transparent` and `currentColor` are not theme colors and are allowed.
const COLOR_LITERAL =
  /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|brown|navy)\b/i

// Every file of src/ (paths relative to it).
const SOURCES = readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(SRC, join(entry.parentPath, entry.name)))
const styles = SOURCES.filter((file) => file.endsWith('.css') && file !== 'app/styles/tokens.css')
// Code may set colors only through the theme module (theme-color, checked above).
const code = SOURCES.filter(
  (file) =>
    /\.tsx?$/.test(file) &&
    !/\.test\.tsx?$/.test(file) &&
    !file.startsWith('test/') &&
    file !== 'platform/theme.ts',
)

describe('colors only from tokens', () => {
  it('finds the style and code files', () => {
    expect(styles).toEqual(expect.arrayContaining(['app/styles/base.css', 'app/styles/fonts.css']))
    expect(code).toContain('main.tsx')
  })

  it.each([...styles, ...code])('%s has no color values of its own', (file) => {
    const lines = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .filter((line) => COLOR_LITERAL.test(line))
    expect(lines).toEqual([])
  })
})
