// Service worker, built by vite-plugin-pwa to /Slowo-dnia/sw.js — the address and scope of the
// prototype's service worker, so the browser updates the existing registration
// (architecture/react-port/pwa.md and release.md → "Ключевые условия перехода" in the workspace).
// Strategy of the prototype: the page from the network, every file of the build from the cache.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { deleteLegacyCaches, isAppNavigation, OFFLINE_PAGE, pageFromNetwork } from './offline'

declare const self: ServiceWorkerGlobalScope

// A new version does not wait for open tabs to close, as in the prototype.
void self.skipWaiting()
clientsClaim()

// Before precacheAndRoute: otherwise the precache route answers /Slowo-dnia/ with its copy of the
// page and a new version shows up only on the second open.
registerRoute(
  ({ request, url }) => isAppNavigation(request, url, self.location.origin),
  ({ request }) =>
    pageFromNetwork(request, {
      fetch: (input, init) => fetch(input, init),
      offlinePage: () => matchPrecache(OFFLINE_PAGE),
    }),
)

// Every file of the build from the cache; requests outside the set go to the network untouched.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteLegacyCaches(self.caches))
})
