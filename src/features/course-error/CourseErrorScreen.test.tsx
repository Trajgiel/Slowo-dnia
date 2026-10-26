// "The adult course did not load" screen (analyst/features/react-port/us-1-start.md → "Взрослый курс не
// загрузился при запуске"; decisions/stack/2026-10-26-course-retry-reload.md).
import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import common from '../../i18n/locales/ru/common.json'
import start from '../../i18n/locales/ru/start.json'
import { reloadPage } from '../../platform/page'
import { renderApp } from '../../test/renderApp'

vi.mock('../../platform/page', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../platform/page')>()),
  reloadPage: vi.fn(),
}))

const PROGRESS = { course: '"adult"', 'adult:done': '[2]' }
const retry = () => screen.getByRole('button', { name: start.adultFailed.retry })

async function press() {
  await act(async () => {
    fireEvent.click(retry())
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.mocked(reloadPage).mockClear()
})

describe('CourseErrorScreen', () => {
  it('the only button on the screen', async () => {
    await renderApp({ storage: PROGRESS, adult: ['network'] })
    expect(screen.getAllByRole('button')).toEqual([retry()])
  })

  it('network error, retry succeeds → adult course on the tab of the address', async () => {
    const { loader, ls } = await renderApp({
      storage: PROGRESS,
      adult: ['network', 'ok'],
      path: '/plan',
    })
    await press()
    expect(await screen.findByRole('tab', { name: common.tabs.plan })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(loader.load).toHaveBeenCalledTimes(2)
    expect(ls.snapshot()).toMatchObject({ course: '"adult"', tab: '"plan"' })
  })

  it('network error again → stays, toast, the button works again', async () => {
    const { loader, ls } = await renderApp({ storage: PROGRESS, adult: ['network'] })
    await press()
    expect(screen.getByRole('status')).toHaveTextContent(common.toast.courseLoadFailed)
    expect(screen.getByText(start.adultFailed.text)).toBeInTheDocument()
    await press()
    expect(loader.load).toHaveBeenCalledTimes(3)
    expect(ls.snapshot()).toEqual(PROGRESS)
  })

  it('a press while loading does not reload the page, the screen stays', async () => {
    await renderApp({ storage: PROGRESS, adult: ['network', 'wait'] })
    await press()
    await press()
    expect(reloadPage).not.toHaveBeenCalled()
    expect(screen.getByText(start.adultFailed.text)).toBeInTheDocument()
  })

  it.each(['not-found', 'invalid'] as const)(
    '%s → the button reloads the page, no new request',
    async (kind) => {
      const { loader } = await renderApp({ storage: PROGRESS, adult: [kind] })
      await press()
      expect(reloadPage).toHaveBeenCalledOnce()
      expect(loader.load).toHaveBeenCalledTimes(1)
    },
  )

  it('network error, then 404 on the retry → the next press reloads', async () => {
    const { loader } = await renderApp({ storage: PROGRESS, adult: ['network', 'not-found'] })
    await press()
    expect(reloadPage).not.toHaveBeenCalled()
    await press()
    expect(reloadPage).toHaveBeenCalledOnce()
    expect(loader.load).toHaveBeenCalledTimes(2)
  })
})
