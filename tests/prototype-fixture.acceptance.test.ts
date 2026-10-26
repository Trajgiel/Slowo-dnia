// @vitest-environment node
// Acceptance, SD-7 (domain logic), support for the criterion "every function matches the prototype":
// the reference code run by src/domain/prototype-parity.acceptance.test.ts
// (src/test/prototype-domain.txt) is a verbatim copy of materials/project/index.html.
// The prototype lives in the workspace, not in this repository: the check runs when it is reachable
// (fe-web inside the workspace, or SD_PROTOTYPE_HTML=<path to index.html>) and is skipped otherwise.
// Not here: the behaviour comparison itself -> src/domain/prototype-parity.acceptance.test.ts.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FIXTURE = fileURLToPath(new URL('../src/test/prototype-domain.txt', import.meta.url))
const PROTOTYPE =
  process.env.SD_PROTOTYPE_HTML ??
  fileURLToPath(new URL('../../materials/project/index.html', import.meta.url))

describe.skipIf(!existsSync(PROTOTYPE))('reference code is verbatim prototype code', () => {
  it('every non-header line of the copy is a line of materials/project/index.html', () => {
    const lines = new Set(readFileSync(PROTOTYPE, 'utf8').split('\n'))
    const copied = readFileSync(FIXTURE, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('//###'))
    expect(copied.length).toBeGreaterThan(150)
    expect(copied.filter((l) => !lines.has(l))).toEqual([])
  })
})
