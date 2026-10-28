import { describe, expect, it, vi } from 'vitest'
import { disableScrollRestoration, reloadPage, scrollIntoCenter, scrollToTop } from './page'

const fakeWindow = () => {
  const win = {
    location: { reload: vi.fn() },
    history: { scrollRestoration: 'auto' },
    scrollTo: vi.fn(),
  }
  return { win, asWindow: win as unknown as Window }
}

describe('page', () => {
  it('reloadPage reloads the location', () => {
    const { win, asWindow } = fakeWindow()
    reloadPage(asWindow)
    expect(win.location.reload).toHaveBeenCalledOnce()
  })

  it('disableScrollRestoration sets history.scrollRestoration to manual', () => {
    const { win, asWindow } = fakeWindow()
    disableScrollRestoration(asWindow)
    expect(win.history.scrollRestoration).toBe('manual')
  })

  it('scrollToTop scrolls the window to 0, 0', () => {
    const { win, asWindow } = fakeWindow()
    scrollToTop(asWindow)
    expect(win.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('scrollIntoCenter scrolls the element to the middle of the screen', () => {
    const element = { scrollIntoView: vi.fn() }
    scrollIntoCenter(element as unknown as Element)
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })
})
