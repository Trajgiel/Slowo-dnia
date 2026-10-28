// Registration of the offline part (architecture/react-port/pwa.md in the workspace → "Регистрация").

export interface ServiceWorkerHost {
  isSecureContext: boolean
  /** `serviceWorker` is missing in browsers without service workers (and in insecure contexts). */
  navigator: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> }
  addEventListener: (type: 'load', listener: () => void, options?: AddEventListenerOptions) => void
}

export interface ServiceWorkerEnv {
  /** `import.meta.env.PROD`: only the build for the site, never `npm run dev`. */
  prod: boolean
  /** `import.meta.env.BASE_URL`, `/Slowo-dnia/`. */
  baseUrl: string
}

/**
 * Same rule as the prototype (https only), plus `localhost`, where the browser also counts the
 * address as secure: end-to-end tests check the offline part on the built site.
 */
export function shouldRegisterServiceWorker(
  env: ServiceWorkerEnv,
  host: ServiceWorkerHost,
): boolean {
  if (!env.prod || !host.isSecureContext) return false
  try {
    return host.navigator.serviceWorker !== undefined
  } catch {
    // Some browsers throw on access to `navigator.serviceWorker` (blocked storage).
    return false
  }
}

/**
 * After `load`, registers `<base>sw.js` with the scope `<base>`: the address and scope of the
 * prototype's service worker, so the browser updates that registration instead of adding a second.
 * A failed registration is silent: the app works, only without offline.
 */
export function registerServiceWorker(
  env: ServiceWorkerEnv,
  host: ServiceWorkerHost = window,
): void {
  if (!shouldRegisterServiceWorker(env, host)) return
  host.addEventListener(
    'load',
    () => {
      try {
        host.navigator.serviceWorker
          ?.register(`${env.baseUrl}sw.js`, { scope: env.baseUrl })
          .catch(() => undefined)
      } catch {
        // Some browsers throw on access to `navigator.serviceWorker` (blocked storage).
      }
    },
    { once: true },
  )
}
