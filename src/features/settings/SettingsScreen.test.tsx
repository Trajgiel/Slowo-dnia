// "Настройки" screen: cards in the prototype's order, pressed state of course, gender and theme,
// gender texts by course, course change (stays on the tab), install steps, contact links and the
// copyright (analyst/features/react-port/us-6-settings.md). A failed load from this tab ->
// e2e/settings.spec.ts (qa).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import settings from '../../i18n/locales/ru/settings.json'
import type { AdultOutcome } from '../../test/fakeLoader'
import { renderApp } from '../../test/renderApp'

function renderSettings(items: Record<string, string> = {}, adult?: AdultOutcome[]) {
  return renderApp({ storage: { course: '"kids"', ...items }, path: '/settings', adult })
}

const group = (name: string) => within(screen.getByRole('group', { name }))
const pressed = (name: string) =>
  group(name)
    .getAllByRole('button')
    .map((b) => [b.textContent, b.getAttribute('aria-pressed')])
const card = (title: string) => {
  const box = screen.getByRole('heading', { level: 3, name: title }).closest('.card')
  if (!(box instanceof HTMLElement)) throw new Error(`no card ${title}`)
  return within(box)
}

describe('"Настройки"', () => {
  it('title and cards top to bottom, then the copyright', async () => {
    await renderSettings()
    expect(screen.getByRole('heading', { level: 2, name: settings.title })).toBeInTheDocument()
    const cards = [...document.querySelectorAll('.view > .card')].map(
      (c) => c.querySelector('h3')?.textContent,
    )
    expect(cards).toEqual([
      settings.course.title,
      settings.kid.title,
      settings.theme.title,
      settings.install.title,
      settings.backup.title,
      settings.reset.title,
      settings.contacts.title,
    ])
    expect(document.querySelector('.view > :last-child')).toHaveClass('copy')
  })

  it('kids course: course note, the kids course pressed, "Девочка | Мальчик" with the kids hint', async () => {
    await renderSettings()
    expect(card(settings.course.title).getByText(settings.course.note)).toBeInTheDocument()
    expect(pressed(settings.course.label)).toEqual([
      [settings.course.kids, 'true'],
      [settings.course.adult, 'false'],
    ])
    expect(pressed(settings.kid.label)).toEqual([
      [settings.kid.kids.girl, 'true'],
      [settings.kid.kids.boy, 'false'],
    ])
    expect(card(settings.kid.title).getByText(settings.kid.hint.kids)).toBeInTheDocument()
  })

  it('adult course with "boy": "Женщина | Мужчина", the second pressed, the adult hint', async () => {
    await renderSettings({ course: '"adult"', 'adult:kid': '"boy"' })
    expect(pressed(settings.course.label)).toEqual([
      [settings.course.kids, 'false'],
      [settings.course.adult, 'true'],
    ])
    expect(pressed(settings.kid.label)).toEqual([
      [settings.kid.adult.girl, 'false'],
      [settings.kid.adult.boy, 'true'],
    ])
    expect(card(settings.kid.title).getByText(settings.kid.hint.adult)).toBeInTheDocument()
  })

  it('gender press → pressed state follows, kid written', async () => {
    const { ls } = await renderSettings()
    fireEvent.click(group(settings.kid.label).getByRole('button', { name: settings.kid.kids.boy }))
    expect(pressed(settings.kid.label)).toEqual([
      [settings.kid.kids.girl, 'false'],
      [settings.kid.kids.boy, 'true'],
    ])
    expect(ls.snapshot()).toMatchObject({ kid: '"boy"' })
  })

  it('theme: dark by default; "Светлая" → pressed, theme written', async () => {
    const { ls } = await renderSettings()
    expect(pressed(settings.theme.label)).toEqual([
      [settings.theme.dark, 'true'],
      [settings.theme.light, 'false'],
    ])
    fireEvent.click(group(settings.theme.label).getByRole('button', { name: settings.theme.light }))
    expect(pressed(settings.theme.label)).toEqual([
      [settings.theme.dark, 'false'],
      [settings.theme.light, 'true'],
    ])
    expect(ls.snapshot()).toMatchObject({ theme: '"light"' })
  })

  it('the stored light theme is pressed', async () => {
    await renderSettings({ theme: '"light"' })
    expect(
      group(settings.theme.label).getByRole('button', { name: settings.theme.light }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('the chosen course again → nothing loads, nothing written', async () => {
    const { ls, loader } = await renderSettings()
    const before = ls.snapshot()
    loader.load.mockClear()
    fireEvent.click(
      group(settings.course.label).getByRole('button', { name: settings.course.kids }),
    )
    expect(loader.load).not.toHaveBeenCalled()
    expect(ls.snapshot()).toEqual(before)
  })

  it('another course → its texts at once, stays on "Настройки"', async () => {
    const { ls, router } = await renderSettings()
    fireEvent.click(
      group(settings.course.label).getByRole('button', { name: settings.course.adult }),
    )
    await waitFor(() => {
      expect(
        group(settings.course.label).getByRole('button', { name: settings.course.adult }),
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(pressed(settings.kid.label)[0]).toEqual([settings.kid.adult.girl, 'true'])
    expect(screen.getByText(settings.kid.hint.adult)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')
    expect(ls.snapshot()).toMatchObject({ course: '"adult"' })
  })

  it('install: lead, numbered steps for iPhone and Android with bold browsers, the note', async () => {
    await renderSettings()
    const install = card(settings.install.title)
    expect(install.getByText(settings.install.lead)).toBeInTheDocument()
    const lists = install.getAllByRole('list')
    expect(lists.map((l) => l.tagName)).toEqual(['OL', 'OL'])
    const steps = lists.map((l) =>
      within(l)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    )
    const plain = (s: string) => s.replace(/<\/?b>/g, '')
    expect(steps).toEqual([
      Object.values(settings.install.ios).slice(0, 4).map(plain),
      Object.values(settings.install.android).slice(0, 4).map(plain),
    ])
    expect(install.getByText('Safari', { selector: 'b' })).toBeInTheDocument()
    expect(install.getByText('Chrome', { selector: 'b' })).toBeInTheDocument()
    expect(install.getByText(settings.install.note)).toBeInTheDocument()
  })

  it('contacts: two links to new tabs, icons hidden from screen readers', async () => {
    await renderSettings()
    const contacts = card(settings.contacts.title)
    const links = contacts.getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      [settings.contacts.telegram, 'https://t.me/Wlodzimierz93'],
      [settings.contacts.linkedin, 'https://www.linkedin.com/in/trajgiel/'],
    ])
    for (const a of links) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener')
      expect(a.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('copyright: the name links to LinkedIn in a new tab', async () => {
    await renderSettings()
    const copy = document.querySelector('.copy')
    expect(copy).toHaveTextContent('© 2026 Wlodzimierz Trajgiel. Все права защищены.')
    const link = within(copy as HTMLElement).getByRole('link', { name: 'Wlodzimierz Trajgiel' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/trajgiel/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })
})
