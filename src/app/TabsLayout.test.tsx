// Tabs and addresses (analyst/features/react-port/us-1-start.md → "Вкладки и адрес";
// architecture/react-port/routing.md → "Маршруты", "Переключение вкладок и «Назад»", "Прокрутка").
import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import common from '../i18n/locales/ru/common.json'
import { renderApp } from '../test/renderApp'

const KIDS = { course: '"kids"' }
const tab = (name: string) => screen.getByRole('tab', { name })
const selected = () =>
  screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')

let scrollTo: ReturnType<typeof vi.fn>
beforeEach(() => {
  scrollTo = vi.fn()
  vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo as unknown as typeof window.scrollTo)
})

describe('tab bar', () => {
  it('a named tab list of the five tabs in prototype order, each with an icon', async () => {
    await renderApp({ storage: KIDS, path: '/word' })
    const list = screen.getByRole('tablist', { name: common.tabs.label })
    const tabs = within(list).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual([
      common.tabs.word,
      common.tabs.quiz,
      common.tabs.plan,
      common.tabs.help,
      common.tabs.settings,
    ])
    for (const t of tabs) expect(t.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(selected()).toEqual([tab(common.tabs.word)])
  })

  it('a press opens the tab: new address step, tab written, page scrolled to the top', async () => {
    const { router, ls } = await renderApp({ storage: KIDS, path: '/word' })
    scrollTo.mockClear()
    act(() => {
      fireEvent.click(tab(common.tabs.quiz))
    })
    expect(router.state.location.pathname).toBe('/quiz')
    expect(router.state.historyAction).toBe('PUSH')
    expect(selected()).toEqual([tab(common.tabs.quiz)])
    expect(ls.snapshot().tab).toBe('"quiz"')
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('a press on the open tab replaces the entry instead of adding one', async () => {
    const { router } = await renderApp({ storage: KIDS, path: '/help' })
    act(() => {
      fireEvent.click(tab(common.tabs.help))
    })
    expect(router.state.location.pathname).toBe('/help')
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('"План" is not scrolled to the top (it scrolls itself)', async () => {
    await renderApp({ storage: KIDS, path: '/word' })
    scrollTo.mockClear()
    act(() => {
      fireEvent.click(tab(common.tabs.plan))
    })
    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('addresses', () => {
  it.each(['/word', '/quiz', '/plan', '/help', '/settings'])('%s opens that tab', async (path) => {
    const { ls } = await renderApp({ storage: KIDS, path })
    const name = path.slice(1) as keyof typeof common.tabs
    expect(selected()).toEqual([tab(common.tabs[name])])
    expect(ls.snapshot().tab).toBe(JSON.stringify(name))
  })

  it.each(['/', '/nope', '/Quiz', '/quiz/extra'])(
    '%s → "Слово", address replaced by /word',
    async (path) => {
      const { router, ls } = await renderApp({ storage: KIDS, path })
      expect(router.state.location.pathname).toBe('/word')
      expect(router.state.historyAction).toBe('REPLACE')
      expect(selected()).toEqual([tab(common.tabs.word)])
      expect(ls.snapshot()).toEqual({ course: '"kids"', tab: '"word"' })
    },
  )

  it('opening the quiz reconciles the deck', async () => {
    const { ls } = await renderApp({ storage: { ...KIDS, done: '[4]' }, path: '/quiz' })
    expect(ls.snapshot()).toEqual({
      course: '"kids"',
      done: '[4]',
      deck_ru: '{"order":[4],"ans":{}}',
      tab: '"quiz"',
    })
  })
})

describe('course chip', () => {
  it('names the course, says what it does and opens "Настройки"', async () => {
    const { router } = await renderApp({ storage: { course: '"adult"' }, path: '/word' })
    const chip = screen.getByRole('button', { name: common.courseChip.label })
    expect(chip).toHaveTextContent(common.course.adult)
    act(() => {
      fireEvent.click(chip)
    })
    expect(router.state.location.pathname).toBe('/settings')
    expect(selected()).toEqual([tab(common.tabs.settings)])
  })

  it('shows the kids course name', async () => {
    await renderApp({ storage: KIDS, path: '/word' })
    expect(screen.getByRole('button', { name: common.courseChip.label })).toHaveTextContent(
      common.course.kids,
    )
  })
})
