// Course gate: what the app shows in each state of the store (architecture/react-port/routing.md →
// "Ворота курса"); the tabs appear only when the course is ready.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import common from '../i18n/locales/ru/common.json'
import start from '../i18n/locales/ru/start.json'
import { renderApp } from '../test/renderApp'

describe('course gate', () => {
  it('new user → course choice without tabs, whatever the address', async () => {
    await renderApp({ path: '/quiz' })
    expect(screen.getByRole('heading', { level: 1, name: common.appName })).toBeInTheDocument()
    expect(screen.getByText(start.lead)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('course loading at start → only the background', async () => {
    const { container, loader, starting } = await renderApp({
      storage: { course: '"adult"' },
      adult: ['wait'],
      started: false,
    })
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('main')).toBeEmptyDOMElement()
    await act(async () => {
      loader.pending[0]?.resolve()
      await starting
    })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('adult course did not load → the message screen without tabs', async () => {
    await renderApp({ storage: { course: '"adult"' }, adult: ['network'], path: '/plan' })
    expect(screen.getByText(start.adultFailed.text)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('course ready → the tab of the address and the tab bar', async () => {
    await renderApp({ storage: { course: '"kids"' }, path: '/help' })
    expect(screen.getByRole('tab', { name: common.tabs.help })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('the toast is a polite live region on every screen', async () => {
    const { store } = await renderApp()
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
    act(() => {
      store.getState().actions.showToast({ id: 'courseLoadFailed' })
    })
    expect(status).toHaveTextContent(common.toast.courseLoadFailed)
  })
})
