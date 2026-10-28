// "Слово" screen: what is shown in each state and after each press, on the real course data
// (analyst/features/react-port/us-2-word.md; analyst/features/react-port/us-12-details.md → склонения серии).
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, dayKey } from '../../domain'
import common from '../../i18n/locales/ru/common.json'
import word from '../../i18n/locales/ru/word.json'
import { fakeSpeech, type FakeVoice } from '../../test/fakeSpeech'
import { realCourses } from '../../test/realCourses'
import { renderApp } from '../../test/renderApp'

afterEach(() => {
  vi.unstubAllGlobals()
})

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i)

/** "Слово" of the kids course with the given learned words and streak days. */
function renderWord(items: Record<string, string> = {}, now = new Date(2026, 9, 26, 12)) {
  return renderApp({
    storage: { course: '"kids"', ...items },
    path: '/word',
    loadCourse: realCourses,
    now: () => now,
  })
}

const card = () => screen.getByText((_, el) => el?.classList.contains('word') ?? false)
const btn = (name: string | RegExp) => screen.getByRole('button', { name })
const learnedBtn = () => btn(/Выучили$/)
const toNew = () => screen.getByText(word.toNew)
const dots = () =>
  within(screen.getByText((_, el) => el?.classList.contains('weekdots') ?? false)).getAllByRole(
    'button',
  )

describe('word card', () => {
  it('first unlearned word: meta line, "новое", Polish in lang="pl", transcription, translation', async () => {
    await renderWord({ done: '[0,1]' })
    const c = within(card())
    expect(c.getByText('Слово 3 из 500')).toBeInTheDocument()
    expect(c.getByText('Тема 1 · Привет и знакомство')).toBeInTheDocument()
    expect(c.getByText(word.badge.new)).toHaveClass('badge')
    expect(c.getByText('Do widzenia!')).toHaveAttribute('lang', 'pl')
    expect(c.getByText('[до видзэ́ня]')).toBeInTheDocument()
    expect(c.getByText('До свидания!')).toBeInTheDocument()
    expect(card()).toHaveAttribute('aria-live', 'polite')
  })

  it('learned word → green "выучено" and "✓ Выучили"', async () => {
    await renderWord({ done: '[0,1]' })
    fireEvent.click(btn(word.prev))
    expect(within(card()).getByText(word.badge.learned)).toHaveClass('badge', 'ok')
    expect(learnedBtn()).toHaveTextContent(word.learned.marked)
    expect(learnedBtn()).toHaveClass('isdone')
  })

  it('neither learned nor the next new → the badge keeps its place, hidden from reading', async () => {
    await renderWord()
    fireEvent.click(btn(word.next))
    const meta = card().querySelector('.meta')
    expect(meta).not.toHaveTextContent(word.badge.new)
    expect(meta).not.toHaveTextContent(word.badge.learned)
    const badge = meta?.querySelector('.badge')
    expect(badge).toHaveClass('inv')
    expect(badge).toHaveAttribute('aria-hidden', 'true')
  })

  it('opens the last word when everything is learned', async () => {
    await renderWord({ done: JSON.stringify(range(0, 500)) })
    expect(within(card()).getByText('Слово 500 из 500')).toBeInTheDocument()
  })
})

describe('arrows', () => {
  it('first word: "←" disabled, "→" opens the next', async () => {
    await renderWord()
    expect(btn(word.prev)).toBeDisabled()
    fireEvent.click(btn(word.next))
    expect(within(card()).getByText('Слово 2 из 500')).toBeInTheDocument()
    expect(btn(word.prev)).toBeEnabled()
  })

  it('last word: "→" disabled', async () => {
    await renderWord({ done: JSON.stringify(range(0, 500)) })
    expect(btn(word.next)).toBeDisabled()
    expect(btn(word.prev)).toBeEnabled()
  })
})

describe('"Выучили"', () => {
  it('marks and unmarks; the word stays; counters, bar and storage follow', async () => {
    const { ls, container } = await renderWord()
    const stats = () => [...container.querySelectorAll('.stat b')].map((b) => b.textContent)
    const bar = () => container.querySelector<HTMLElement>('.bar i')?.style.width
    expect(stats()).toEqual(['0', '500', '0%'])

    fireEvent.click(learnedBtn())
    expect(learnedBtn()).toHaveTextContent(word.learned.marked)
    expect(within(card()).getByText('Слово 1 из 500')).toBeInTheDocument()
    expect(within(card()).getByText(word.badge.learned)).toBeInTheDocument()
    expect(stats()).toEqual(['1', '499', '0%'])
    expect(bar()).toBe('0.2%')
    expect(ls.snapshot()).toMatchObject({ done: '[0]', weak: '{}', days: '["2026-10-26"]' })

    fireEvent.click(learnedBtn())
    expect(learnedBtn()).toHaveTextContent(word.learned.mark)
    expect(learnedBtn()).not.toHaveClass('isdone')
    expect(within(card()).getByText(word.badge.new)).toBeInTheDocument()
    expect(stats()).toEqual(['0', '500', '0%'])
    expect(ls.snapshot()).toMatchObject({ done: '[]', days: '["2026-10-26"]' })
  })

  it('percent is rounded: 3 of 500 → 1%', async () => {
    const { container } = await renderWord({ done: '[0,1,2]' })
    expect(container.querySelectorAll('.stat b')[2]).toHaveTextContent('1%')
  })
})

describe('"Вернуться к новому слову"', () => {
  it('on the next new word: hidden but in place, out of tab order and reading', async () => {
    await renderWord()
    expect(toNew()).toHaveClass('inv')
    expect(toNew()).toHaveAttribute('tabindex', '-1')
    expect(toNew()).toHaveAttribute('aria-hidden', 'true')
  })

  it('on another word: visible; a press opens the first unlearned word', async () => {
    await renderWord({ done: '[0]' })
    fireEvent.click(btn(word.next))
    fireEvent.click(btn(word.next))
    expect(toNew()).not.toHaveClass('inv')
    expect(toNew()).not.toHaveAttribute('tabindex')
    expect(toNew()).not.toHaveAttribute('aria-hidden')
    fireEvent.click(btn(word.toNew))
    expect(within(card()).getByText('Слово 2 из 500')).toBeInTheDocument()
    expect(toNew()).toHaveClass('inv')
  })
})

describe('theme dots', () => {
  it('a dot per word of the theme: number, name, learned and current; a press opens the word', async () => {
    await renderWord({ done: '[0,2]' })
    expect(screen.getByText('Тема 1: Привет и знакомство')).toBeInTheDocument()
    const all = dots()
    expect(all.map((d) => d.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(all[0]).toHaveAccessibleName('Слово 1: Cześć!')
    expect(all[0]).toHaveClass('d')
    expect(all[1]).toHaveClass('c')
    expect(all[1]).toHaveAttribute('aria-current', 'true')
    expect(all[2]).not.toHaveAttribute('aria-current')
    expect(all[2]).toHaveClass('d')
    fireEvent.click(btn('Слово 5: Mam na imię…'))
    expect(within(card()).getByText('Слово 5 из 500')).toBeInTheDocument()
    expect(dots()[4]).toHaveAttribute('aria-current', 'true')
  })

  it('adult course, last theme: numbers up to 1000, one column per word', async () => {
    await renderApp({
      storage: { course: '"adult"', 'adult:done': JSON.stringify(range(0, 1000)) },
      path: '/word',
      loadCourse: realCourses,
    })
    const all = dots()
    expect(all.map((d) => d.textContent)).toEqual(range(991, 1001).map(String))
    expect(all[9]?.parentElement?.style.gridTemplateColumns).toBe('repeat(10, minmax(0, 1fr))')
  })
})

describe('streak line', () => {
  const NOW = new Date(2026, 9, 26, 0, 30)
  /** `n` consecutive days ending `back` days before 2026-10-26. */
  const streakDays = (n: number, back = 0) =>
    JSON.stringify(
      range(0, n)
        .reverse()
        .map((i) => dayKey(addDays(NOW, -(i + back)))),
    )
  const line = (container: HTMLElement) => container.querySelector('.streak')

  it('no days → no line', async () => {
    const { container } = await renderWord({}, NOW)
    expect(line(container)).toBeNull()
  })

  it('days, but neither today nor yesterday → start a new streak', async () => {
    const { container } = await renderWord({ days: '["2026-10-20"]' }, NOW)
    expect(line(container)).toHaveTextContent(word.streak.start)
  })

  it.each([
    [1, '🔥 1 день подряд'],
    [2, '🔥 2 дня подряд'],
    [5, '🔥 5 дней подряд'],
    [11, '🔥 11 дней подряд'],
    [21, '🔥 21 день подряд'],
    [112, '🔥 112 дней подряд'],
  ])('today marked, %i days → "%s"', async (n, text) => {
    const { container } = await renderWord({ days: streakDays(n) }, NOW)
    expect(line(container)?.textContent).toBe(text)
  })

  it('today not marked → counts from yesterday and asks to mark today', async () => {
    const { container } = await renderWord({ days: streakDays(3, 1) }, NOW)
    expect(line(container)?.textContent).toBe(
      '🔥 3 дня подряд. Отметьте слово сегодня, чтобы не прервать серию',
    )
  })

  it('local day: a mark at 00:30 counts for the new day after yesterday', async () => {
    const { container } = await renderWord({ days: '["2026-10-25"]' }, NOW)
    fireEvent.click(learnedBtn())
    expect(line(container)?.textContent).toBe('🔥 2 дня подряд')
  })
})

describe('speech', () => {
  function withSpeech(voices: readonly FakeVoice[]) {
    const fake = fakeSpeech(voices)
    vi.stubGlobal('speechSynthesis', fake.host.speechSynthesis)
    vi.stubGlobal('SpeechSynthesisUtterance', fake.host.SpeechSynthesisUtterance)
    return fake
  }
  const message = (container: HTMLElement) =>
    [...container.querySelectorAll('section > .msg')].map((m) => m.textContent)

  it('Polish voice → the open word is spoken, no message', async () => {
    const fake = withSpeech([{ lang: 'pl-PL', name: 'Zosia' }])
    const { container } = await renderWord({ done: '[0]' })
    fireEvent.click(btn(common.speak))
    expect(fake.spoken.map((u) => u.text)).toEqual(['Dzień dobry!'])
    expect(message(container)).toEqual([])
  })

  it('no Polish voice → spoken anyway, the message points to "Как"', async () => {
    const fake = withSpeech([{ lang: 'ru-RU', name: 'Milena' }])
    const { container } = await renderWord()
    fireEvent.click(btn(common.speak))
    expect(fake.spoken).toHaveLength(1)
    expect(message(container)).toEqual([common.speech.noVoice])
  })

  it('no speech in the browser → the transcription message', async () => {
    const { container } = await renderWord()
    fireEvent.click(btn(common.speak))
    expect(message(container)).toEqual([common.speech.unsupported])
  })

  it.each([
    ['→', word.next],
    ['a dot', 'Слово 3: Do widzenia!'],
  ])('another word opened by %s → the message is hidden', async (_, name) => {
    const { container } = await renderWord()
    fireEvent.click(btn(common.speak))
    fireEvent.click(btn(name))
    expect(message(container)).toEqual([])
  })
})

describe('praise toast', () => {
  it('the last word of a theme → "Тема «…» выучена! Brawo!"', async () => {
    await renderWord({ done: JSON.stringify(range(0, 6)) })
    fireEvent.click(learnedBtn())
    expect(screen.getByRole('status')).toHaveTextContent(
      '🎉 Тема «Привет и знакомство» выучена! Brawo!',
    )
  })

  it('the last word of the course → "Все 500 слов выучены! Gratulacje!"', async () => {
    await renderWord({ done: JSON.stringify(range(0, 499)) })
    fireEvent.click(learnedBtn())
    expect(screen.getByRole('status')).toHaveTextContent('🏆 Все 500 слов выучены! Gratulacje!')
  })
})
