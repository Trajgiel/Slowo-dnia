// @vitest-environment node
// Dictionary completeness (architecture/react-port/i18n.md → "Правило «строк нет в разметке»"): every key
// the code asks for is in the `ru` dictionary. Literal keys are found in the source; keys built at run time
// (`tabs.${name}`) are listed below with every value they can take, and a new built key the list does not
// know fails the test. Component tests add the run-time check: their i18n throws on a missing key.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COURSE_IDS, TAB_NAMES } from '../domain'
import { createI18n, defaultNS, NAMESPACES, type Namespace } from '../i18n'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const i18n = createI18n()

/** Keys built at run time: the template as written in the code → the values of its placeholder. */
const BUILT_KEYS: Readonly<Record<string, readonly string[]>> = {
  'tabs.${name}': TAB_NAMES,
  'course.${course}': COURSE_IDS,
}

const sources = readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
  .map((e) => join(e.parentPath, e.name))
  .filter((file) => !relative(SRC, file).startsWith('test/'))

interface Use {
  readonly file: string
  readonly key: string
  /** Namespaces the key may come from: `ns:` prefix, else those of `useTranslation(...)` in the file. */
  readonly namespaces: readonly string[]
}

function uses(): { literal: Use[]; built: Use[] } {
  const literal: Use[] = []
  const built: Use[] = []
  for (const file of sources) {
    const text = readFileSync(file, 'utf8')
    const declared = [...text.matchAll(/useTranslation\(([^)]*)\)/g)].flatMap(([, args]) =>
      [...(args ?? '').matchAll(/'([^']+)'/g)].map(([, ns]) => ns ?? ''),
    )
    const namespaces = declared.length ? declared : [defaultNS]
    const name = relative(SRC, file)
    for (const [, key = ''] of text.matchAll(/\bt\(\s*'([^']+)'/g)) {
      const colon = key.indexOf(':')
      literal.push(
        colon < 0
          ? { file: name, key, namespaces }
          : { file: name, key: key.slice(colon + 1), namespaces: [key.slice(0, colon)] },
      )
    }
    for (const [, key = ''] of text.matchAll(/\bt\(\s*`([^`]+)`/g)) {
      built.push({ file: name, key, namespaces })
    }
  }
  return { literal, built }
}

/** Russian plural forms (architecture/react-port/i18n.md → "Склонения"). */
const PLURAL_FORMS = ['one', 'few', 'many', 'other'] as const

/** A plain key, or a plural key (called with `count`) that has every Russian form. */
const exists = (namespaces: readonly string[], key: string) =>
  namespaces.some((ns) => {
    const has = (k: string) => i18n.exists(k, { ns: ns as Namespace })
    return has(key) || PLURAL_FORMS.every((form) => has(`${key}_${form}`))
  })

describe('ru dictionary covers the code', () => {
  const { literal, built } = uses()

  it('finds the calls (the scan is not empty)', () => {
    expect(literal.length).toBeGreaterThan(10)
    expect(built.map((u) => u.key).sort()).toEqual(Object.keys(BUILT_KEYS).sort())
  })

  it.each(literal.map((u) => [`${u.file}: ${u.key}`, u] as const))('%s', (_, use) => {
    expect(exists(use.namespaces, use.key)).toBe(true)
  })

  it.each(built.map((u) => [`${u.file}: ${u.key}`, u] as const))('%s, every value', (_, use) => {
    const values = BUILT_KEYS[use.key] ?? []
    const keys = values.map((v) => use.key.replace(/\$\{[^}]+\}/, v))
    expect(keys.filter((key) => !exists(use.namespaces, key))).toEqual([])
  })

  it('namespaces used in the code are dictionaries', () => {
    const all = [...literal, ...built].flatMap((u) => u.namespaces)
    expect(all.filter((ns) => !(NAMESPACES as readonly string[]).includes(ns))).toEqual([])
  })
})
