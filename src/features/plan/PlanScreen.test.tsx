// "План" screen: what is shown for the stored progress, open themes through tab and gender changes,
// a press on a word, the current word scrolled into view (analyst/features/react-port/us-5-plan-help.md → "План").
import { act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expandWords } from '../../domain'
import common from '../../i18n/locales/ru/common.json'
import plan from '../../i18n/locales/ru/plan.json'
import { realCourses } from '../../test/realCourses'
import { renderApp } from '../../test/renderApp'

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

function renderPlan(items: Record<string, string> = {}) {
  return renderApp({
    storage: { course: '"kids"', ...items },
    path: '/plan',
    loadCourse: realCourses,
  })
}

const themes = () => [...document.querySelectorAll('.plan details')] as HTMLDetailsElement[]
const theme = (n: number) => {
  const el = themes()[n - 1]
  if (!el) throw new Error(`no theme ${String(n)}`)
  return el
}
const openThemes = () => themes().flatMap((d, i) => (d.open ? [i + 1] : []))
const summary = (n: number) => {
  const el = theme(n).querySelector('summary')
  if (!el) throw new Error(`no summary ${String(n)}`)
  return el
}
const item = (n: number) => {
  const el = document.querySelectorAll<HTMLButtonElement>('.plan button.item')[n - 1]
  if (!el) throw new Error(`no word ${String(n)}`)
  return el
}
/** The toggle event of `<details>` comes in a task after the change. */
const toggled = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const tab = (name: string) => screen.getByRole('tab', { name })

describe('"План": themes and words', () => {
  it('title, lead and all 71 themes of the kids course', async () => {
    await renderPlan()
    expect(screen.getByRole('heading', { name: plan.title })).toBeInTheDocument()
    expect(screen.getByText(plan.lead)).toBeInTheDocument()
    expect(themes()).toHaveLength(71)
  })

  it('theme line: number, title, learned counter; green when the theme is done', async () => {
    await renderPlan({ done: JSON.stringify([...range(0, 7), 8]) })
    const first = within(summary(1))
    expect(first.getByText('Тема 1')).toHaveClass('wk')
    expect(first.getByText('Привет и знакомство')).toHaveClass('th')
    expect(first.getByText('7/7')).toHaveClass('cnt', 'full')
    expect(within(summary(2)).getByText('1/7')).not.toHaveClass('full')
  })

  it('word row: number, Polish in lang="pl", translation, "✓" only for learned', async () => {
    await renderPlan({ done: '[0]' })
    const first = within(item(1))
    expect(first.getByText('1')).toHaveClass('n')
    expect(first.getByText('Cześć!')).toHaveAttribute('lang', 'pl')
    expect(first.getByText('Привет!')).toBeInTheDocument()
    expect(item(1).querySelector('.ck')).toHaveTextContent('✓')
    expect(item(2).querySelector('.ck')).toHaveTextContent('')
  })

  it('the current word (first unlearned) is marked, its theme alone is open', async () => {
    await renderPlan({ done: JSON.stringify(range(0, 9)) })
    expect(item(10)).toHaveClass('cur')
    expect(document.querySelectorAll('.plan .item.cur')).toHaveLength(1)
    expect(openThemes()).toEqual([2])
  })

  it('"Выучили" elsewhere → the mark and the counter change at once', async () => {
    const { store } = await renderPlan()
    act(() => {
      store.getState().actions.toggleLearned()
    })
    expect(item(1).querySelector('.ck')).toHaveTextContent('✓')
    expect(within(summary(1)).getByText('1/7')).toBeInTheDocument()
  })
})

describe('"План": open themes', () => {
  it('opened and closed by hand → the same after another tab', async () => {
    await renderPlan()
    fireEvent.click(summary(3))
    fireEvent.click(summary(1))
    await toggled()
    expect(openThemes()).toEqual([3])
    fireEvent.click(tab(common.tabs.help))
    fireEvent.click(tab(common.tabs.plan))
    expect(openThemes()).toEqual([3])
  })

  it('gender change → open themes stay, words and theme titles change', async () => {
    const { store } = await renderPlan()
    const ready = store.getState().words.findIndex((w) => w.theme === 'Я готова!')
    const n = (store.getState().words[ready]?.ti ?? 0) + 1
    fireEvent.click(summary(n))
    await toggled()
    act(() => {
      const { courseData } = store.getState()
      if (courseData) store.setState({ gender: 'boy', words: expandWords(courseData, 'boy') })
    })
    expect(within(summary(n)).getByText('Я готов!')).toBeInTheDocument()
    expect(openThemes()).toEqual([1, n])
  })
})

describe('"План": press on a word and scroll', () => {
  it('a word opens "Слово" with that word, as a new history step', async () => {
    const { router } = await renderPlan()
    fireEvent.click(item(12))
    expect(router.state.location.pathname).toBe('/word')
    expect(screen.getByText('Слово 12 из 500')).toBeInTheDocument()
    expect(router.state.historyAction).toBe('PUSH')
  })

  it('opening the tab scrolls the current word to the middle, again on a repeated press', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
    scroll.mockClear()
    const toTop = vi.spyOn(window, 'scrollTo')
    await renderPlan({ done: '[0,1,2]' })
    expect(scroll).toHaveBeenCalledWith({ block: 'center' })
    expect(scroll.mock.contexts.at(-1)).toBe(item(4))
    fireEvent.click(tab(common.tabs.plan))
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(toTop).not.toHaveBeenCalled()
  })
})
