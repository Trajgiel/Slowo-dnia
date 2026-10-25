// @vitest-environment node
// Acceptance, SD-6 (skeleton with CI), criteria:
// - an import against the direction of the layers fails `npm run lint`
//   (architecture/react-port/modules.md, "Layers and direction of dependencies");
// - interface text in JSX outside the dictionary fails `npm run lint`
//   (architecture/react-port/i18n.md, "No strings in markup").
// Probe code is linted with the repository's eslint.config.js (the one `npm run lint` uses) at
// file paths inside src/ that do not exist, so no violating file ever lands in the repository.
// Type-aware rules are switched off for the probes (the project service sees only files on disk);
// the rules under test are not type-aware.
// Not here: build output -> skeleton-build.acceptance.test.ts.
import { ESLint, type Linter } from 'eslint'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const eslint = new ESLint({
  cwd: root,
  overrideConfig: tseslint.configs.disableTypeChecked as Linter.Config,
})

async function lint(filePath: string, code: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, {
    filePath: `${root}${filePath}`,
    warnIgnored: true,
  })
  if (!result) throw new Error(`No lint result for ${filePath}`)
  // A parse error or an ignored path would make every "no error" assertion pass vacuously.
  expect(result.messages.filter((m) => m.fatal === true || m.ruleId === null)).toEqual([])
  return result.messages
}

const ruleErrors = (messages: Linter.LintMessage[], ruleId: string) =>
  messages.filter((m) => m.ruleId === ruleId && m.severity === 2)

describe('layers: imports go only down (no-restricted-imports)', () => {
  it.each([
    // from the task: domain imports neither react nor other layers; features do not import storage
    ['src/domain/qa-probe.ts', 'react'],
    ['src/domain/qa-probe.ts', '../state'],
    ['src/domain/qa-probe.ts', '../storage/keys'],
    ['src/domain/qa-probe.ts', '../i18n'],
    ['src/features/qa-probe.tsx', '../storage'],
    ['src/features/word/qa-probe.tsx', '../../storage/keys'],
    // from the architecture: storage knows neither state, features nor React
    ['src/storage/qa-probe.ts', 'react'],
    ['src/storage/qa-probe.ts', '../state'],
    ['src/storage/qa-probe.ts', '../features'],
    // upwards in general
    ['src/state/qa-probe.ts', '../features'],
    ['src/shared/ui/qa-probe.tsx', '../../app'],
    ['src/features/qa-probe.tsx', '../app'],
  ])('%s importing %s is an error', async (file, target) => {
    const messages = await lint(file, `import '${target}'\n`)
    expect(ruleErrors(messages, 'no-restricted-imports')).toHaveLength(1)
  })

  it.each([
    ['src/app/qa-probe.tsx', '../features'],
    ['src/features/qa-probe.tsx', '../state'],
    ['src/features/qa-probe.tsx', '../shared/ui'],
    ['src/features/qa-probe.tsx', 'react'],
    ['src/state/qa-probe.ts', '../storage'],
    ['src/storage/qa-probe.ts', '../domain'],
    ['src/domain/qa-probe.ts', './dates'],
  ])('%s importing %s is allowed', async (file, target) => {
    const messages = await lint(file, `import '${target}'\n`)
    expect(ruleErrors(messages, 'no-restricted-imports')).toEqual([])
  })
})

describe('no interface text in JSX (i18next/no-literal-string)', () => {
  const component = (jsx: string) =>
    `import { useTranslation } from 'react-i18next'\n` +
    `export function Probe() {\n  const { t } = useTranslation()\n  return ${jsx}\n}\n`

  it.each([
    ['text in an element', `<p title={t('appName')}>Выучили</p>`],
    ['Latin text in an element', `<p title={t('appName')}>Next word</p>`],
    ['a visible attribute', `<button aria-label="Назад">{t('appName')}</button>`],
    ['a placeholder', `<input placeholder="Код" title={t('appName')} />`],
  ])('%s is an error', async (_case, jsx) => {
    const messages = await lint('src/features/qa-probe.tsx', component(jsx))
    expect(ruleErrors(messages, 'i18next/no-literal-string')).toHaveLength(1)
  })

  it('text from the dictionary and decoration symbols are allowed', async () => {
    const jsx = `<p lang="pl" title={t('appName')}>{t('appName')} <span>✓</span></p>`
    const messages = await lint('src/features/qa-probe.tsx', component(jsx))
    expect(ruleErrors(messages, 'i18next/no-literal-string')).toEqual([])
  })
})
