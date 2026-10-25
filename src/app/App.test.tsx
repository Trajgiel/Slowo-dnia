import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { createI18n } from '../i18n'
import common from '../i18n/locales/ru/common.json'
import { App } from './App'

describe('App placeholder', () => {
  it('shows the app name from the ru dictionary', () => {
    render(
      <I18nextProvider i18n={createI18n()}>
        <App />
      </I18nextProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(common.appName)
  })
})
