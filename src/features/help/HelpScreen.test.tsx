// "Как" screen: texts of the chosen course and gender, common sections, the bold platform names of the
// voice setup; a course change shows the new course's texts at once
// (analyst/features/react-port/us-5-plan-help.md → "Как").
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import help from '../../i18n/locales/ru/help.json'
import { renderApp } from '../../test/renderApp'

function renderHelp(items: Record<string, string>) {
  return renderApp({ storage: items, path: '/help' })
}

const section = (title: string) => {
  const box = screen.getByRole('heading', { level: 3, name: title }).parentElement
  if (!box) throw new Error(`no section ${title}`)
  return within(box)
}
const items = (title: string) =>
  section(title)
    .getAllByRole('listitem')
    .map((li) => li.textContent)

const kidsTips = (gender: 'girl' | 'boy') => [
  help.tips.gender.kids[gender],
  help.tips.kids.teacher,
  help.tips.kids.size,
]
const adultTips = (gender: 'girl' | 'boy') => [
  help.tips.gender.adult[gender],
  help.tips.adult.address,
  help.tips.adult.size,
]

describe('"Как"', () => {
  it('kids course: title, sections in order, kids lists only', async () => {
    await renderHelp({ course: '"kids"' })
    expect(screen.getByRole('heading', { level: 2, name: help.title })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      help.daily.title,
      help.review.title,
      help.pronunciation.title,
      help.tips.title,
      help.noVoice.title,
    ])
    expect(items(help.daily.title)).toEqual(Object.values(help.daily.kids))
    expect(items(help.review.title)).toEqual(Object.values(help.review.kids))
    expect(items(help.tips.title)).toEqual(kidsTips('girl'))
  })

  it('kids course, boy → the boy line', async () => {
    await renderHelp({ course: '"kids"', kid: '"boy"' })
    expect(items(help.tips.title)).toEqual(kidsTips('boy'))
  })

  it.each(['girl', 'boy'] as const)('adult course, %s → adult lists and line', async (gender) => {
    await renderHelp({ course: '"adult"', 'adult:kid': JSON.stringify(gender) })
    expect(items(help.daily.title)).toEqual(Object.values(help.daily.adult))
    expect(items(help.review.title)).toEqual(Object.values(help.review.adult))
    expect(items(help.tips.title)).toEqual(adultTips(gender))
  })

  it('pronunciation: the text and seven letters with their sounds', async () => {
    await renderHelp({ course: '"kids"' })
    const s = section(help.pronunciation.title)
    expect(s.getByText(help.pronunciation.text)).toHaveClass('msg')
    const table = document.querySelector('.sounds')
    expect([...(table?.children ?? [])].map((el) => el.textContent)).toEqual(
      Object.values(help.sounds).flatMap((row) => [row.letter, row.text]),
    )
  })

  it('no Polish voice: platform names in bold, the rest as plain text', async () => {
    await renderHelp({ course: '"kids"' })
    const s = section(help.noVoice.title)
    expect(s.getByText('iPhone и iPad:').tagName).toBe('B')
    expect(s.getByText('Android:').tagName).toBe('B')
    expect(items(help.noVoice.title)).toEqual([
      help.noVoice.ios.replace(/<\/?b>/g, ''),
      help.noVoice.android.replace(/<\/?b>/g, ''),
      help.noVoice.restart,
    ])
  })

  it('course change → the new course texts at once', async () => {
    const { store } = await renderHelp({ course: '"kids"' })
    await act(() => store.getState().actions.selectCourse('adult'))
    expect(items(help.daily.title)).toEqual(Object.values(help.daily.adult))
    expect(items(help.tips.title)).toEqual(adultTips('girl'))
  })
})
