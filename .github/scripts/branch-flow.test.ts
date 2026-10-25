// @vitest-environment node
// Tests for branch-flow.sh: task branches -> develop -> main, no staging
// (CONTRIBUTING.md of the workspace, "Pull Request direction").
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('./branch-flow.sh', import.meta.url))

function check(base: string, head: string, key = 'ABC') {
  const result = spawnSync('bash', [script], {
    env: { PATH: process.env.PATH, BASE_REF: base, HEAD_REF: head, TASK_KEY: key },
    encoding: 'utf8',
  })
  return { code: result.status, output: result.stdout + result.stderr }
}

describe('branch-flow', () => {
  it.each([
    ['develop', 'feature/ABC-18/app-skeleton'],
    ['develop', 'fix/ABC-31/expired-session-token'],
    ['develop', 'refactor/ABC-40/auth-module'],
    ['develop', 'style/ABC-29/theme-tokens'],
    ['develop', 'test/ABC-25/price-table'],
    ['develop', 'info/ABC-1/ci-check'],
    ['main', 'develop'],
  ])('allows %s <- %s', (base, head) => {
    const { code, output } = check(base, head)
    expect(code).toBe(0)
    expect(output).toContain('OK:')
  })

  describe('project key', () => {
    it('accepts a branch with the project key SD (pr.yml -> TASK_KEY)', () => {
      expect(check('develop', 'feature/SD-6/react-skeleton-ci', 'SD').code).toBe(0)
    })

    it('rejects another key', () => {
      expect(check('develop', 'feature/XYZ-18/app-skeleton').code).toBe(1)
    })

    it.each(['feature/XYZ-18/app-skeleton', 'feature/A1-18/app-skeleton'])(
      'accepts any upper-case key when TASK_KEY is empty: %s',
      (head) => {
        expect(check('develop', head, '').code).toBe(0)
      },
    )

    it.each(['A.*', 'abc'])('treats TASK_KEY %j that is not a key as an error', (key) => {
      const { code, output } = check('develop', 'feature/ABC-18/app-skeleton', key)
      expect(code).toBe(1)
      expect(output).toContain('is not a task key')
    })
  })

  it.each([
    // wrong source for a long-lived base
    ['main', 'feature/ABC-18/app-skeleton'],
    ['main', 'fix/ABC-31/expired-session-token'],
    ['main', 'staging'],
    ['develop', 'staging'],
    ['develop', 'main'],
    // malformed task branches
    ['develop', 'feature/abc-18/app-skeleton'],
    ['develop', 'feature/ABC-18/App-Skeleton'],
    ['develop', 'feature/ABC-18'],
    ['develop', 'feature/ABC-18/'],
    ['develop', 'feature/ABC-x/app-skeleton'],
    ['develop', 'feature/ABC-/app-skeleton'],
    ['develop', 'feat/ABC-18/app-skeleton'],
    ['develop', 'feature/ABC-18/app_skeleton'],
    ['develop', 'feature/ABC-18/app/skeleton'],
    ['develop', 'hotfix'],
  ])('rejects %s <- %s', (base, head) => {
    const { code, output } = check(base, head)
    expect(code).toBe(1)
    expect(output).toContain('::error title=Branch flow::')
  })

  // Near-miss names: catch a rule loosened to a prefix/substring match or a
  // regex that lost an anchor (CONTRIBUTING.md, "Pull Request direction").
  it.each([
    ['main', 'develop-old'],
    ['main', 'feature/ABC-18/develop'],
    ['main', 'develop '],
    ['main', 'Develop'],
    ['main', 'main'],
    ['develop', 'develop'],
    ['develop', 'release/feature/ABC-18/app-skeleton'],
    ['develop', 'Feature/ABC-18/app-skeleton'],
    ['develop', 'feature/ABC-18/app-skeleton '],
    ['develop', ''],
    ['main', ''],
  ])('rejects the near-miss %s <- %j', (base, head) => {
    const { code, output } = check(base, head)
    expect(code).toBe(1)
    expect(output).toContain('::error title=Branch flow::')
  })

  it.each([
    ['feature/ABC-18/app-skeleton', 'fix/ABC-18/review-fixes'],
    // There is no staging branch in this repository: it is not a long-lived base.
    ['staging', 'develop'],
  ])('skips the check for the base %s that is not a long-lived branch', (base, head) => {
    const { code, output } = check(base, head)
    expect(code).toBe(0)
    expect(output).toContain('direction check skipped')
  })

  it('names the only allowed source in the main error', () => {
    const { output } = check('main', 'feature/ABC-18/app-skeleton')
    expect(output).toBe(
      "::error title=Branch flow::PR 'feature/ABC-18/app-skeleton' -> 'main' is not allowed. Into main only from develop.\n",
    )
  })

  describe('treats branch names as data, not as shell code', () => {
    const developRule =
      'Into develop only task branches: <feature|fix|refactor|style|test|info>/ABC-<number>/<kebab-case-description>.'

    it('prints the payload verbatim', () => {
      const head = 'feature/ABC-1/x$(echo INJECTED)`echo INJECTED`;echo INJECTED'
      const { code, output } = check('develop', head)

      expect(code).toBe(1)
      expect(output).toBe(
        `::error title=Branch flow::PR '${head}' -> 'develop' is not allowed. ${developRule}\n`,
      )
    })

    it.each([
      ['command substitution', (file: string) => `feature/ABC-1/x$(touch ${file})`],
      ['backticks', (file: string) => `feature/ABC-1/x\`touch ${file}\``],
      ['command separator', (file: string) => `feature/ABC-1/x;touch ${file}`],
    ])('does not run %s', (_name, payload) => {
      const dir = mkdtempSync(join(tmpdir(), 'branch-flow-'))
      const marker = join(dir, 'marker')
      try {
        const { code } = check('develop', payload(marker))
        expect(code).toBe(1)
        expect(existsSync(marker)).toBe(false)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
