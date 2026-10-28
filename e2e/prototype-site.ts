// The published prototype, served for end-to-end tests that compare the new version with it in the same
// browser: a static site at /Slowo-dnia/ on a random port, files of the prototype commit on `main`.
// The prototype registers its offline part only on https, so on this http server it runs without one.
// The source (PROTOTYPE_COMMIT, PROTOTYPE_DIR) is shared with e2e/release-transition.offline.spec.ts.
import { execFileSync } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The last prototype commit on `main` (51cba24): what GitHub Pages serves until the release. */
export const PROTOTYPE_COMMIT = '51cba2452bfb211ca3f77cdeeda26083bdacc587'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

/** The prototype folder: PROTOTYPE_DIR, or the prototype commit unpacked into `dir`. */
export function preparePrototype(dir: string): string {
  if (process.env.PROTOTYPE_DIR) return resolve(process.env.PROTOTYPE_DIR)
  const archive = `${dir}.tar`
  try {
    execFileSync('git', ['archive', '--output', archive, PROTOTYPE_COMMIT], {
      cwd: ROOT,
      stdio: 'pipe',
    })
  } catch (error) {
    throw new Error(
      `The prototype commit ${PROTOTYPE_COMMIT} is not in this checkout: fetch the full history ` +
        '(CI: fetch-depth: 0) or set PROTOTYPE_DIR to a copy of the prototype.',
      { cause: error },
    )
  }
  execFileSync('mkdir', ['-p', dir])
  execFileSync('tar', ['-xf', archive, '-C', dir])
  return dir
}

export interface PrototypeSite {
  baseUrl: string
  close(): Promise<void>
}

/** Serves the prototype (unpacked into `dir`) until `close`. */
export async function startPrototype(dir: string): Promise<PrototypeSite> {
  const root = preparePrototype(dir)
  const server: Server = createServer((req, res) => {
    let path: string
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://site').pathname)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end()
      return
    }
    let file = path.startsWith('/Slowo-dnia/')
      ? resolve(root, `.${path.slice('/Slowo-dnia'.length)}`)
      : ''
    if (file && !file.startsWith(root + sep) && file !== root) file = ''
    try {
      if (file && statSync(file).isDirectory()) file = join(file, 'index.html')
      if (!file || !statSync(file).isFile()) throw new Error('not a file')
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${String(port)}/Slowo-dnia/`,
    close: () =>
      new Promise((done) => {
        server.close(() => {
          done()
        })
        // Keep-alive connections of the page would hold `close` until they time out.
        server.closeAllConnections()
      }),
  }
}
