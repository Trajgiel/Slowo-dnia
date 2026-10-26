import type { i18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { DataRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppStoreProvider, type AppStore } from '../state'

export interface AppProps {
  readonly store: AppStore
  readonly router: DataRouter
  readonly i18n: i18n
}

/**
 * Providers around the router. Router updates are not transitions (`useTransitions={false}`): the
 * address and the store change in the same render, so a screen never shows with the previous address.
 */
export function App({ store, router, i18n }: AppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppStoreProvider store={store}>
        <RouterProvider router={router} useTransitions={false} />
      </AppStoreProvider>
    </I18nextProvider>
  )
}
