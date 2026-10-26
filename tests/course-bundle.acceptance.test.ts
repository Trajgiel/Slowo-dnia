// @vitest-environment node
// Acceptance, SD-10 (course data), criteria on the production build (decisions/stack/2026-10-26-adult-course-json.md):
// - the adult course is a separate file with a hash in its name; the main code holds only its address,
//   not its words, and index.html does not load it at start;
// - the kids course (all 500 Polish words) is in the main code.
// Until the app shell (SD-12) imports the loader, the build drops it as unused code; so the build here
// adds `import { loadCourse } from './data'` to src/main.tsx with a probe plugin, as the app will do.
// Once src/main.tsx (or code it imports) uses the loader, the probe is not needed.
// Not here: the data itself -> src/data/courseData.test.ts, tests/course-data-prototype.acceptance.test.ts;
// the loader logic (one request, retry, 404, shape) -> src/data/loadCourse.test.ts;
// base path, fonts, icons, no requests outside -> tests/skeleton-build.acceptance.test.ts.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Themes = [string, [string, string, string, unknown?][]][]

const root = fileURLToPath(new URL('..', import.meta.url))
// Under node_modules so that the config resolves `vite` and the project config like the real one.
const probeDir = join(root, 'node_modules/.tmp/course-bundle-probe')
const probeConfig = join(probeDir, 'vite.config.mjs')
let outDir = ''

const PROBE = `import { mergeConfig } from 'vite'
import base from ${JSON.stringify(join(root, 'vite.config.ts'))}

const main = ${JSON.stringify(join(root, 'src/main.tsx'))}
export default mergeConfig(base, {
  plugins: [
    {
      name: 'course-bundle-probe',
      transform(code, id) {
        if (id !== main) return null
        return code + "\\nimport { loadCourse as probeLoadCourse } from './data'\\nglobalThis.probeLoadCourse = probeLoadCourse\\n"
      },
    },
  ],
})
`

const read = (path: string) => readFileSync(path, 'utf8')
const adultData = JSON.parse(read(join(root, 'src/data/adult.json'))) as Themes
// The kids course as it is in the source (src/data/kidsCourse.ts is generated from the same data).
const kidsCourse = read(join(root, 'src/data/kidsCourse.ts'))
const kidsPl = (
  JSON.parse(read(join(root, 'src/test/fixtures/prototype-courses.json'))) as { kids: Themes }
).kids.flatMap(([, entries]) => entries.map((entry) => entry[0]))

let assets: string[] = []
let html = ''
let mainJs = ''
let allJs = ''

beforeAll(() => {
  mkdirSync(probeDir, { recursive: true })
  writeFileSync(probeConfig, PROBE)
  outDir = mkdtempSync(join(tmpdir(), 'slowo-dnia-course-bundle-'))
  const env: NodeJS.ProcessEnv = { ...process.env }
  // Vitest sets NODE_ENV=test; the real build runs without it.
  delete env.NODE_ENV
  const result = spawnSync(
    join(root, 'node_modules/.bin/vite'),
    ['build', '--config', probeConfig, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: root, env, encoding: 'utf8' },
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  assets = readdirSync(join(outDir, 'assets'))
  html = read(join(outDir, 'index.html'))
  const mainName = /<script[^>]*\ssrc="\/Slowo-dnia\/assets\/([^"]+\.js)"/.exec(html)?.[1] ?? ''
  mainJs = read(join(outDir, 'assets', mainName))
  allJs = assets
    .filter((name) => name.endsWith('.js'))
    .map((name) => read(join(outDir, 'assets', name)))
    .join('\n')
}, 60_000)

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true })
  rmSync(probeDir, { recursive: true, force: true })
})

describe('course data in the production build', () => {
  it('the adult course is one separate hashed JSON file with the whole course', () => {
    const files = assets.filter((name) => name.startsWith('adult'))
    expect(files).toHaveLength(1)
    const [file = ''] = files
    expect(file).toMatch(/^adult-[\w-]{8,}\.json$/)
    expect(JSON.parse(read(join(outDir, 'assets', file)))).toEqual(adultData)
  })

  it('the main code holds the adult file address, not its words; the page does not load it', () => {
    const [file = ''] = assets.filter((name) => name.startsWith('adult'))
    expect(file).not.toBe('')
    // A boolean, not toContain: a failure would print the whole bundle.
    expect(
      mainJs.includes(`/Slowo-dnia/assets/${file}`),
      'adult file address in the main code',
    ).toBe(true)
    // Phrases of the adult course that do not occur anywhere in the kids course.
    const adultOnly = adultData
      .flatMap(([, entries]) => entries.map((entry) => entry[0]))
      .filter((pl) => pl.length > 12 && !/["'\\]/.test(pl) && !kidsCourse.includes(pl))
    expect(adultOnly.length).toBeGreaterThan(100)
    expect(adultOnly.filter((pl) => allJs.includes(pl))).toEqual([])
    expect(html).not.toContain('adult')
  })

  it('the kids course is in the main code: all 500 Polish words', () => {
    expect(kidsPl).toHaveLength(500)
    const plain = kidsPl.filter((pl) => !/["'\\]/.test(pl))
    expect(plain.length).toBeGreaterThan(450)
    expect(plain.filter((pl) => !mainJs.includes(pl))).toEqual([])
    expect(assets.filter((name) => /kids/i.test(name))).toEqual([])
  })
})
