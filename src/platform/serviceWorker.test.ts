import { describe, expect, it, vi } from 'vitest'
import {
  registerServiceWorker,
  shouldRegisterServiceWorker,
  type ServiceWorkerEnv,
  type ServiceWorkerHost,
} from './serviceWorker'

const BUILD: ServiceWorkerEnv = { prod: true, baseUrl: '/Slowo-dnia/' }
const DEV: ServiceWorkerEnv = { prod: false, baseUrl: '/Slowo-dnia/' }

type Register = Pick<ServiceWorkerContainer, 'register'>['register']

/** A window stand-in: `load` fires only when the test calls `fireLoad`. */
function fakeHost(
  options: {
    secure?: boolean
    register?: Register | null
    navigatorThrows?: boolean
  } = {},
) {
  const register = vi.fn<Register>(
    options.register ?? (() => Promise.resolve({} as ServiceWorkerRegistration)),
  )
  const listeners: (() => void)[] = []
  const navigator: ServiceWorkerHost['navigator'] = options.navigatorThrows
    ? {
        get serviceWorker(): never {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      }
    : options.register === null
      ? {}
      : { serviceWorker: { register } }
  const host: ServiceWorkerHost = {
    isSecureContext: options.secure ?? true,
    navigator,
    addEventListener: vi.fn((_type: 'load', listener: () => void) => {
      listeners.push(listener)
    }),
  }
  const fireLoad = (): void => {
    for (const listener of listeners.splice(0)) listener()
  }
  return { host, register, fireLoad }
}

describe('shouldRegisterServiceWorker', () => {
  it.each([
    ['build on https / localhost', BUILD, { secure: true }, true],
    ['npm run dev (not the build)', DEV, { secure: true }, false],
    ['build on plain http (not localhost)', BUILD, { secure: false }, false],
    ['browser without service workers', BUILD, { register: null }, false],
    ['access to navigator.serviceWorker throws', BUILD, { navigatorThrows: true }, false],
  ] as const)('%s → %s', (_case, env, options, expected) => {
    expect(shouldRegisterServiceWorker(env, fakeHost(options).host)).toBe(expected)
  })
})

describe('registerServiceWorker', () => {
  it('registers <base>sw.js with the scope <base> only after load', () => {
    const { host, register, fireLoad } = fakeHost()
    registerServiceWorker(BUILD, host)
    expect(register).not.toHaveBeenCalled()

    fireLoad()
    expect(register).toHaveBeenCalledOnce()
    expect(register).toHaveBeenCalledWith('/Slowo-dnia/sw.js', { scope: '/Slowo-dnia/' })
  })

  it.each([
    ['npm run dev', DEV, { secure: true }],
    ['plain http', BUILD, { secure: false }],
    ['no service workers', BUILD, { register: null }],
  ] as const)('%s → no load listener, nothing registered', (_case, env, options) => {
    const { host, register, fireLoad } = fakeHost(options)
    registerServiceWorker(env, host)
    fireLoad()
    expect(host.addEventListener).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it('a rejected registration is silent: no unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { host, register, fireLoad } = fakeHost({
        register: () => Promise.reject(new TypeError('sw.js: 404')),
      })
      registerServiceWorker(BUILD, host)
      expect(() => {
        fireLoad()
      }).not.toThrow()
      expect(register).toHaveBeenCalledOnce()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('a register() that throws right away is silent too', () => {
    const { host, fireLoad } = fakeHost({
      register: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    registerServiceWorker(BUILD, host)
    expect(() => {
      fireLoad()
    }).not.toThrow()
  })
})
