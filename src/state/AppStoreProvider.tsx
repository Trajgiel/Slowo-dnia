import type { ReactNode } from 'react'
import type { AppStore } from './appStore'
import { AppStoreContext } from './context'

/** Gives the components below the app store (one per app; tests pass their own). */
export function AppStoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <AppStoreContext value={store}>{children}</AppStoreContext>
}
