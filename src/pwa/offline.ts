// Logic of the offline part (architecture/react-port/pwa.md in the workspace → "Офлайн-часть"),
// kept apart from src/pwa/sw.ts so Vitest can run it without a service worker.
// Only types shared by the DOM and WebWorker libraries are used here.

/** Cache names of the prototype's service worker (`slowo-dnia-v6` and older). */
export const LEGACY_CACHE_PREFIX = 'slowo-dnia-'

/** The page in the precache: the offline answer to every navigation inside the site. */
export const OFFLINE_PAGE = 'index.html'

/** A navigation (page load) of our own site; requests to other domains are left alone. */
export function isAppNavigation(request: Request, url: URL, origin: string): boolean {
  return request.method === 'GET' && request.mode === 'navigate' && url.origin === origin
}

export interface PageSources {
  fetch: (input: Request, init?: RequestInit) => Promise<Response>
  /** The page of the installed version (Workbox `matchPrecache`). */
  offlinePage: () => Promise<Response | undefined>
}

/**
 * The page: network first, revalidated with the server (`no-cache`: GitHub Pages sends
 * `max-age=600`), never written to the cache, so the offline copy changes only together with the
 * whole set of its version. No network → the precached page; nothing there → a network error.
 */
export async function pageFromNetwork(request: Request, sources: PageSources): Promise<Response> {
  try {
    return await sources.fetch(request, { cache: 'no-cache' })
  } catch {
    return (await sources.offlinePage()) ?? Response.error()
  }
}

/** Removes the prototype's caches (`slowo-dnia-*`); Workbox caches and others stay. */
export async function deleteLegacyCaches(
  cacheStorage: Pick<CacheStorage, 'keys' | 'delete'>,
): Promise<void> {
  const names = await cacheStorage.keys()
  await Promise.all(
    names
      .filter((name) => name.startsWith(LEGACY_CACHE_PREFIX))
      .map((name) => cacheStorage.delete(name)),
  )
}
