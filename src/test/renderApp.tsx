import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { App, appRoutes } from '../app'
import type { LoadCourse } from '../data'
import { createAppStore } from '../state'
import { createRepo } from '../storage'
import { fakeLoader, type AdultOutcome } from './fakeLoader'
import { FakeStorage } from './fakeStorage'
import { createStrictI18n } from './i18n'
import { seqRng } from './rng'

export interface RenderAppOptions {
  /** Raw `localStorage` text of each key. */
  readonly storage?: Record<string, string>
  /** Outcomes of the adult course loads, in turn. */
  readonly adult?: AdultOutcome[]
  /** Router path the app opens at (after `#`). */
  readonly path?: string
  /** Wait for the start-up before rendering (default: start and render together, as `main.tsx`). */
  readonly started?: boolean
  /** Course loader instead of the fake one (`adult` is then ignored), e.g. `realCourses`. */
  readonly loadCourse?: LoadCourse
  /** The store's clock (default: 2026-10-26 12:00 local time). */
  readonly now?: () => Date
}

/** The whole app (store, router, i18n) on a fake storage, a fake loader and a memory router. */
export async function renderApp(options: RenderAppOptions = {}) {
  const ls = new FakeStorage(options.storage)
  const loader = fakeLoader(options.adult)
  const store = createAppStore({
    storage: createRepo(() => ls),
    loadCourse: options.loadCourse ?? loader.load,
    now: options.now ?? (() => new Date(2026, 9, 26, 12)),
    rng: seqRng(0),
  })
  const router = createMemoryRouter(appRoutes, { initialEntries: [options.path ?? '/'] })
  const starting = store.getState().actions.start()
  if (options.started !== false) await starting
  const view = render(<App store={store} router={router} i18n={createStrictI18n()} />)
  return { ...view, ls, loader, store, router, starting }
}
