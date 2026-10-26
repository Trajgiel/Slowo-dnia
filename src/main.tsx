import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { App } from './app'
import { createI18n } from './i18n'
import './app/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={createI18n()}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)
