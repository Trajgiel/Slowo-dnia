// Course choice screen (analyst/features/react-port/us-1-start.md → "Экран выбора курса").
import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import common from '../../i18n/locales/ru/common.json'
import start from '../../i18n/locales/ru/start.json'
import { renderApp } from '../../test/renderApp'

const pick = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) })

describe('StartScreen', () => {
  it('shows the title, the lead, two course cards and the note', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(common.appName)
    expect(screen.getByText(start.lead)).toBeInTheDocument()
    expect(pick(start.kids.title)).toHaveTextContent(
      `${start.kids.title}${start.kids.course}${start.kids.about}`,
    )
    expect(pick(start.adult.title)).toHaveTextContent(
      `${start.adult.title}${start.adult.course}${start.adult.about}`,
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByText(start.note)).toBeInTheDocument()
  })

  it.each([
    ['kids', start.kids.title],
    ['adult', start.adult.title],
  ])('%s → tabs on "Слово", address replaced by /word', async (course, title) => {
    const { router, ls } = await renderApp({ path: '/quiz' })
    await act(async () => {
      fireEvent.click(pick(title))
      await Promise.resolve()
    })
    expect(await screen.findByRole('tab', { name: common.tabs.word })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(router.state.location.pathname).toBe('/word')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(ls.snapshot()).toEqual({ course: JSON.stringify(course), tab: '"word"' })
  })

  it('adult course fails → toast, stays on the choice, nothing written', async () => {
    const { router, ls } = await renderApp({ adult: ['network'], path: '/quiz' })
    await act(async () => {
      fireEvent.click(pick(start.adult.title))
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent(common.toast.courseLoadFailed)
    expect(screen.getByText(start.lead)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/quiz')
    expect(ls.snapshot()).toEqual({})
  })
})
