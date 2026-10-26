import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter } from 'react-router'
import { App, appRoutes, migrateLegacyAddress } from './app'
import { loadCourse } from './data'
import { createI18n } from './i18n'
import { disableScrollRestoration } from './platform'
import { createAppStore } from './state'
import { storage } from './storage'
import './app/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

// Before the router reads the address: old `#quiz` → `#/quiz` (architecture/react-port/routing.md).
migrateLegacyAddress()
disableScrollRestoration()

const store = createAppStore({
  storage,
  loadCourse,
  now: () => new Date(),
  rng: Math.random,
})
void store.getState().actions.start()

// Created once, outside the React tree.
const router = createHashRouter(appRoutes)

createRoot(root).render(
  <StrictMode>
    <App store={store} router={router} i18n={createI18n()} />
  </StrictMode>,
)
