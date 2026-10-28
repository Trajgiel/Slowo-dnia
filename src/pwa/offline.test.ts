// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { deleteLegacyCaches, isAppNavigation, pageFromNetwork, type PageSources } from './offline'

const ORIGIN = 'https://trajgiel.github.io'
const PAGE = `${ORIGIN}/Slowo-dnia/`

/** Node cannot build a `navigate` request itself, so the mode is set on a plain one. */
function request(url: string, mode: RequestMode, method = 'GET'): Request {
  const req = new Request(url, { method })
  Object.defineProperty(req, 'mode', { value: mode })
  return req
}

describe('isAppNavigation', () => {
  it.each([
    ['page load of the site', request(PAGE, 'navigate'), true],
    ['old tab address (index.html#quiz)', request(`${PAGE}index.html#quiz`, 'navigate'), true],
    ['file of the site (not a page load)', request(`${PAGE}assets/a.js`, 'no-cors'), false],
    ['page load of another domain', request('https://t.me/x', 'navigate'), false],
    ['POST navigation (form)', request(PAGE, 'navigate', 'POST'), false],
  ])('%s → %s', (_case, req, expected) => {
    expect(isAppNavigation(req, new URL(req.url), ORIGIN)).toBe(expected)
  })
})

describe('pageFromNetwork', () => {
  const offline = new Response('offline copy')

  it('network answers → the network page, revalidated with the server (no-cache)', async () => {
    const network = new Response('new version')
    const sources: PageSources = {
      fetch: vi.fn<PageSources['fetch']>(() => Promise.resolve(network)),
      offlinePage: vi.fn<PageSources['offlinePage']>(() => Promise.resolve(offline)),
    }
    const req = request(PAGE, 'navigate')

    expect(await pageFromNetwork(req, sources)).toBe(network)
    expect(sources.fetch).toHaveBeenCalledWith(req, { cache: 'no-cache' })
    expect(sources.offlinePage).not.toHaveBeenCalled()
  })

  it('an HTTP error page is still the network answer, not the offline copy', async () => {
    const notFound = new Response('404', { status: 404 })
    const sources: PageSources = {
      fetch: () => Promise.resolve(notFound),
      offlinePage: vi.fn<PageSources['offlinePage']>(() => Promise.resolve(offline)),
    }
    expect(await pageFromNetwork(request(PAGE, 'navigate'), sources)).toBe(notFound)
    expect(sources.offlinePage).not.toHaveBeenCalled()
  })

  it('no network and nothing precached → a network error, no exception', async () => {
    const sources: PageSources = {
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      offlinePage: () => Promise.resolve(undefined),
    }
    const res = await pageFromNetwork(request(PAGE, 'navigate'), sources)
    expect(res.type).toBe('error')
  })
})

describe('deleteLegacyCaches', () => {
  it("deletes only the prototype's slowo-dnia-* caches", async () => {
    const names = [
      'slowo-dnia-v6',
      'slowo-dnia-v5',
      'workbox-precache-v2-https://trajgiel.github.io/Slowo-dnia/',
      'other-cache',
    ]
    const cacheStorage = {
      keys: vi.fn(() => Promise.resolve(names)),
      delete: vi.fn<(name: string) => Promise<boolean>>(() => Promise.resolve(true)),
    }
    await deleteLegacyCaches(cacheStorage)
    expect(cacheStorage.delete.mock.calls.map(([name]) => name).sort()).toEqual([
      'slowo-dnia-v5',
      'slowo-dnia-v6',
    ])
  })

  it('no caches → nothing deleted', async () => {
    const cacheStorage = { keys: () => Promise.resolve([]), delete: vi.fn() }
    await deleteLegacyCaches(cacheStorage)
    expect(cacheStorage.delete).not.toHaveBeenCalled()
  })
})
