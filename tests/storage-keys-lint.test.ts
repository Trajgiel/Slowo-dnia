// @vitest-environment node
// SD-9: storage key names only in src/storage/keys.ts, localStorage only in src/storage/kv.ts,
// src/storage used from outside only through its index (eslint.config.js, storageConfigs and
// `storageIndexOnly`). Probes are linted at paths that do not exist, as in skeleton-lint.acceptance.test.ts.
import { ESLint, type Linter } from 'eslint'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const eslint = new ESLint({
  cwd: root,
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } } },
  ],
})

async function errors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: `${root}${filePath}`,
    warnIgnored: true,
  })
  if (!result) throw new Error(`No lint result for ${filePath}`)
  expect(
    result.messages.filter((m: Linter.LintMessage) => m.fatal === true || m.ruleId === null),
  ).toEqual([])
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? '')
}

describe('storage keys and access', () => {
  it.each([
    [
      'localStorage global',
      'export const v = localStorage.getItem("x")\n',
      'no-restricted-globals',
    ],
    ['sessionStorage global', 'export const v = sessionStorage\n', 'no-restricted-globals'],
    ['window.localStorage', 'export const v = window.localStorage\n', 'no-restricted-properties'],
    [
      'globalThis.localStorage',
      'export const v = globalThis.localStorage\n',
      'no-restricted-properties',
    ],
    ['adult key', "export const k = 'adult:done'\n", 'no-restricted-syntax'],
    ['qmode', "export const k = 'qmode'\n", 'no-restricted-syntax'],
    ['qdir', "export const k = 'qdir'\n", 'no-restricted-syntax'],
    ['deck key', "export const k = 'deck_pl'\n", 'no-restricted-syntax'],
    ['result key', "export const k = 'last_ru'\n", 'no-restricted-syntax'],
    [
      'key built in a template',
      'export const k = (d: string) => `prev_${d}`\n',
      'no-restricted-syntax',
    ],
    ['storage internals', "export { createKv } from '../storage/kv'\n", 'no-restricted-imports'],
  ])('%s outside storage → error', async (_, code, rule) => {
    expect(await errors('src/state/sd9-probe.ts', code)).toContain(rule)
  })

  it('app imports storage internals → error', async () => {
    expect(await errors('src/app/sd9-probe.ts', "export * from '../storage/keys'\n")).toContain(
      'no-restricted-imports',
    )
  })

  it('the entry point imports storage internals → error, the index → allowed', async () => {
    expect(await errors('src/main.tsx', "export * from './storage/kv'\n")).toContain(
      'no-restricted-imports',
    )
    expect(await errors('src/main.tsx', "export { storage } from './storage'\n")).toEqual([])
  })

  it.each([
    ['storage index', "export { storage } from '../storage'\n"],
    ['bare course prefix', "export const p = 'adult:'\n"],
    ['ordinary words', "export const x = { kind: 'theme', role: 'tab', done: 'done' }\n"],
  ])('%s outside storage → allowed', async (_, code) => {
    expect(await errors('src/state/sd9-probe.ts', code)).toEqual([])
  })

  it('kv may use localStorage, keys may spell key names', async () => {
    expect(await errors('src/storage/kv.ts', 'export const s = globalThis.localStorage\n')).toEqual(
      [],
    )
    expect(await errors('src/storage/keys.ts', "export const k = 'adult:deck_ru'\n")).toEqual([])
  })

  it('test files may seed localStorage', async () => {
    expect(
      await errors('src/state/sd9-probe.test.ts', "localStorage.setItem('qmode', '\"free\"')\n"),
    ).toEqual([])
  })
})
