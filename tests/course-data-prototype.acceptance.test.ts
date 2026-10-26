// @vitest-environment node
// Acceptance, SD-10 (course data), the reference side of the data comparison:
// - the prototype fixture (src/test/fixtures/prototype-courses.json) is the prototype itself:
//   it equals W, BOY, BOY_THEME and window.COURSE_ADULT as the prototype page holds them after
//   its own scripts ran in a DOM (not sliced and evaluated like scripts/extract-courses.ts does),
//   so a bug of the transfer script cannot hide in both the data and the fixture;
// - the prototype taken is the published one (git blobs of index.html and courses/adult.js on
//   the prototype's `main`, the same as materials/project in the workspace).
// The prototype comes from PROTOTYPE_DIR (a folder with index.html and courses/adult.js, e.g.
// ../Slowo-dnia/materials/project) or from the git objects of this repository; a shallow clone
// without the prototype history skips the test.
// Not here: app data against the fixture, every word and both genders -> src/data/courseData.test.ts;
// the build output of the courses -> tests/course-bundle.acceptance.test.ts.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Git blob ids of the prototype files (the last prototype commit on `main`, 51cba24). */
const PROTOTYPE_BLOBS = {
  html: '1d137699c0553bdfee378d2d331819e24c67b4cf',
  adult: '75c6cde01a9ab3718c14eb45421639bf26bb1e75',
} as const

interface JsdomWindow {
  eval(code: string): unknown
  close(): void
}
interface JsdomModule {
  JSDOM: new (
    html: string,
    options: { runScripts: 'dangerously'; url: string; virtualConsole: unknown },
  ) => { window: JsdomWindow }
  VirtualConsole: new () => { on(event: 'jsdomError', listener: (error: Error) => void): void }
}

const root = fileURLToPath(new URL('..', import.meta.url))
const { JSDOM, VirtualConsole } = createRequire(import.meta.url)('jsdom') as JsdomModule

const blobId = (text: string) => {
  const bytes = Buffer.from(text, 'utf8')
  return createHash('sha1')
    .update(`blob ${String(bytes.length)}\0`)
    .update(bytes)
    .digest('hex')
}

function readPrototype(): { html: string; adult: string } | null {
  const dir = process.env.PROTOTYPE_DIR
  if (dir) {
    return {
      html: readFileSync(join(dir, 'index.html'), 'utf8'),
      adult: readFileSync(join(dir, 'courses', 'adult.js'), 'utf8'),
    }
  }
  try {
    const blob = (id: string) =>
      execFileSync('git', ['cat-file', 'blob', id], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    return { html: blob(PROTOTYPE_BLOBS.html), adult: blob(PROTOTYPE_BLOBS.adult) }
  } catch {
    return null
  }
}

const prototype = readPrototype()

describe.skipIf(!prototype)('prototype fixture', () => {
  const source = prototype ?? { html: '', adult: '' }

  it('is taken from the published prototype files', () => {
    expect(blobId(source.html)).toBe(PROTOTYPE_BLOBS.html)
    expect(blobId(source.adult)).toBe(PROTOTYPE_BLOBS.adult)
  })

  it('equals the course data the prototype page holds after its scripts ran', () => {
    const errors: string[] = []
    const virtualConsole = new VirtualConsole()
    virtualConsole.on('jsdomError', (error) => errors.push(error.message))
    const { window } = new JSDOM(source.html, {
      runScripts: 'dangerously',
      url: 'http://localhost/',
      virtualConsole,
    })
    try {
      // The prototype loads courses/adult.js as a classic script that sets window.COURSE_ADULT.
      window.eval(source.adult)
      const live: unknown = JSON.parse(
        window.eval(
          'JSON.stringify({ kids: W, boy: BOY, boyTheme: BOY_THEME, adult: window.COURSE_ADULT })',
        ) as string,
      )
      expect(errors).toEqual([])
      const fixture: unknown = JSON.parse(
        readFileSync(join(root, 'src/test/fixtures/prototype-courses.json'), 'utf8'),
      )
      expect(fixture).toEqual(live)
    } finally {
      window.close()
    }
  })
})
