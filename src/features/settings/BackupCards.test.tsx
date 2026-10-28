// "Резервная копия прогресса" and "Начать заново" cards (analyst/features/react-port/us-7-backup-reset.md):
// texts with the open course, "Отправить…" only with the system share, the field, status lines with the
// "слово / слова / слов" forms, the clipboard and share outcomes, both twice-pressed buttons and leaving
// the tab after the first press. Storage writes are the store test's (state/appStore.backup.test.ts);
// no clipboard (the code selected in the field) -> e2e/backup.spec.ts (qa).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBackupCode } from '../../domain'
import common from '../../i18n/locales/ru/common.json'
import settings from '../../i18n/locales/ru/settings.json'
import { renderApp } from '../../test/renderApp'

const status = settings.backup.status

function stubNavigator(name: 'clipboard' | 'share', value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true })
}

afterEach(() => {
  for (const name of ['clipboard', 'share'] as const) {
    Reflect.deleteProperty(navigator, name)
  }
})

function renderSettings(items: Record<string, string> = {}) {
  return renderApp({ storage: { course: '"kids"', ...items }, path: '/settings' })
}

const card = (title: string) => {
  const box = screen.getByRole('heading', { level: 3, name: title }).closest('.card')
  if (!(box instanceof HTMLElement)) throw new Error(`no card ${title}`)
  return within(box)
}
const field = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: settings.backup.codeLabel })
const statusLine = () => card(settings.backup.title).getByRole('status')
const button = (name: string) => screen.getByRole('button', { name })

const fill = (text: string) => {
  fireEvent.change(field(), { target: { value: text } })
}
const pressTwice = (name: string, armed: string) => {
  fireEvent.click(button(name))
  fireEvent.click(button(armed))
}

const kidsName = common.course.kids
const adultName = common.course.adult

describe('"Резервная копия прогресса" and "Начать заново": texts', () => {
  it.each([
    ['kids', kidsName],
    ['adult', adultName],
  ])('%s: lead, the open course in bold in both cards', async (course, name) => {
    await renderSettings({ course: JSON.stringify(course) })
    const backup = card(settings.backup.title)
    expect(backup.getByText(settings.backup.lead)).toBeInTheDocument()
    expect(backup.getByText(`«${name}»`).tagName).toBe('B')
    expect(backup.getByText(`«${name}»`).parentElement).toHaveTextContent(
      `Сейчас выбран «${name}»: код сохраняет и восстанавливает прогресс только этого курса.`,
    )
    const reset = card(settings.reset.title)
    expect(reset.getByText(`«${name}»`).tagName).toBe('B')
    expect(reset.getByText(`«${name}»`).parentElement).toHaveTextContent(
      `результаты опроса курса «${name}». Другой курс не затрагивается.`,
    )
    expect(statusLine()).toBeEmptyDOMElement()
  })

  it('code field: placeholder, no spell check, autocorrect or capitals', async () => {
    await renderSettings()
    expect(field()).toHaveAttribute('placeholder', settings.backup.codePlaceholder)
    expect(field()).toHaveAttribute('spellcheck', 'false')
    expect(field()).toHaveAttribute('autocapitalize', 'off')
    expect(field()).toHaveAttribute('autocorrect', 'off')
    expect(field()).toHaveAttribute('autocomplete', 'off')
  })

  it('no system share → no "Отправить…", "Скопировать код" alone in the row', async () => {
    await renderSettings()
    expect(screen.queryByRole('button', { name: settings.backup.share })).toBeNull()
    expect(button(settings.backup.copy).parentElement).toHaveClass('row2', 'one')
  })

  it('with the system share → both buttons in two columns', async () => {
    stubNavigator(
      'share',
      vi.fn(() => Promise.resolve()),
    )
    await renderSettings()
    expect(button(settings.backup.share)).toBeInTheDocument()
    expect(button(settings.backup.copy).parentElement).not.toHaveClass('one')
  })
})

describe('copy and share', () => {
  it('"Скопировать код": the code in the field and the clipboard, "скопирован (выучено 3 слова)"', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator('clipboard', { writeText })
    await renderSettings({ done: '[0,1,2]' })
    fireEvent.click(button(settings.backup.copy))
    await waitFor(() => {
      expect(statusLine()).toHaveTextContent(
        `Код курса «${kidsName}» скопирован (выучено 3 слова). Сохраните его в надёжном месте.`,
      )
    })
    const code = createBackupCode('kids', { done: [0, 1, 2], weak: {}, days: [] })
    expect(writeText).toHaveBeenCalledWith(code)
    expect(field()).toHaveValue(code)
  })

  it.each([
    ['kids', settings.backup.shareTitle.kids],
    ['adult', settings.backup.shareTitle.adult],
  ])(
    '"Отправить…" (%s): the system share with the title and the code; cancel shows nothing',
    async (course, title) => {
      const share = vi.fn(() => Promise.reject(new DOMException('cancel', 'AbortError')))
      stubNavigator('share', share)
      await renderSettings({ course: JSON.stringify(course) })
      fireEvent.click(button(settings.backup.share))
      expect(share).toHaveBeenCalledWith({
        title,
        text: createBackupCode(course === 'adult' ? 'adult' : 'kids', {
          done: [],
          weak: {},
          days: [],
        }),
      })
      await act(() => Promise.resolve())
      expect(statusLine()).toBeEmptyDOMElement()
      expect(field()).toHaveValue('')
    },
  )
})

describe('"Восстановить из кода"', () => {
  it('first press only warns; the second restores: status, the field keeps the code', async () => {
    const { store } = await renderSettings()
    const code = createBackupCode('kids', { done: [0, 1, 2, 3, 4], weak: {}, days: [] })
    fill(code)
    fireEvent.click(button(settings.backup.restore))
    expect(button(settings.backup.restoreConfirm)).toHaveClass('primary', 'armed')
    expect(store.getState().done.size).toBe(0)
    fireEvent.click(button(settings.backup.restoreConfirm))
    expect(statusLine()).toHaveTextContent(
      `Прогресс курса «${kidsName}» восстановлен: выучено 5 слов.`,
    )
    expect(button(settings.backup.restore)).not.toHaveClass('armed')
    expect(field()).toHaveValue(code)
  })

  it.each([
    [1, 'слово'],
    [2, 'слова'],
    [5, 'слов'],
    [21, 'слово'],
    [112, 'слов'],
  ])('%i learned → "выучено %i %s"', async (count, form) => {
    await renderSettings()
    const done = Array.from({ length: count }, (_, i) => i)
    fill(createBackupCode('kids', { done, weak: {}, days: [] }))
    pressTwice(settings.backup.restore, settings.backup.restoreConfirm)
    expect(statusLine()).toHaveTextContent(`выучено ${String(count)} ${form}.`)
  })

  it.each([
    ['broken', 'SD1.k.%%%', status.unreadable],
    [
      'another course',
      createBackupCode('adult', { done: [1], weak: {}, days: [] }),
      `Это код курса «${adultName}». Переключите курс выше на «${adultName}» и восстановите код там.`,
    ],
    ['no progress inside', 'SD1.k.bnVsbA', `В этом коде нет прогресса курса «${kidsName}».`],
  ])('%s → its status', async (_name, code, text) => {
    await renderSettings()
    fill(code)
    pressTwice(settings.backup.restore, settings.backup.restoreConfirm)
    expect(statusLine()).toHaveTextContent(text)
  })
})

describe('"Сбросить прогресс"', () => {
  it('first press turns it red with the warning; the second resets: toast, status cleared, field kept', async () => {
    const { store } = await renderSettings({ done: '[0,1]' })
    fill('SD1.k.%%%')
    pressTwice(settings.backup.restore, settings.backup.restoreConfirm)
    expect(statusLine()).toHaveTextContent(status.unreadable)

    fireEvent.click(button(settings.reset.button))
    expect(button(settings.reset.confirm)).toHaveClass('danger', 'armed')
    expect(store.getState().done.size).toBe(2)
    fireEvent.click(button(settings.reset.confirm))
    expect(store.getState().done.size).toBe(0)
    expect(button(settings.reset.button)).not.toHaveClass('armed')
    expect(statusLine()).toBeEmptyDOMElement()
    expect(field()).toHaveValue('SD1.k.%%%')
    expect(screen.getByText(settings.reset.toast)).toBeInTheDocument()
  })

  it('leaving the tab after the first press: back on the tab the label is plain, nothing reset', async () => {
    const { store, router } = await renderSettings({ done: '[0,1]' })
    fireEvent.click(button(settings.reset.button))
    fill(createBackupCode('kids', { done: [7], weak: {}, days: [] }))
    fireEvent.click(button(settings.backup.restore))
    await act(() => router.navigate('/word'))
    await act(() => router.navigate('/settings'))
    expect(button(settings.reset.button)).not.toHaveClass('armed')
    expect(button(settings.backup.restore)).not.toHaveClass('armed')
    fireEvent.click(button(settings.reset.button))
    fireEvent.click(button(settings.backup.restore))
    expect([...store.getState().done]).toEqual([0, 1])
  })
})
