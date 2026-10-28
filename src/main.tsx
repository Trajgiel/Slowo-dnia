import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter } from 'react-router'
import './app/styles/index.css'
import { App, appRoutes, migrateLegacyAddress } from './app'
import { loadCourse } from './data'
import { createI18n } from './i18n'
import {
  applyTheme,
  disableScrollRestoration,
  primeVoices,
  registerServiceWorker,
} from './platform'
import { createAppStore } from './state'
import { storage } from './storage'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

// Before the router reads the address: old `#quiz` → `#/quiz` (architecture/react-port/routing.md).
migrateLegacyAddress()
disableScrollRestoration()
primeVoices()
// Offline part: only the build for the site, on https or localhost; failures are silent.
registerServiceWorker({ prod: import.meta.env.PROD, baseUrl: import.meta.env.BASE_URL })

const store = createAppStore({
  storage,
  loadCourse,
  now: () => new Date(),
  rng: Math.random,
  applyTheme,
})
void store.getState().actions.start()

// Created once, outside the React tree.
const router = createHashRouter(appRoutes)

createRoot(root).render(
  <StrictMode>
    <App store={store} router={router} i18n={createI18n()} />
  </StrictMode>,
)
