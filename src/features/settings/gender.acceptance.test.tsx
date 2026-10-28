// Acceptance, SD-16 ("Кто учится"), the whole app on the real kids course: one press in "Настройки",
// then every tab that shows first-person phrases.
// Covers (analyst/features/react-port/us-6-settings.md → "Кто учится (род)" in the workspace):
// - "Мальчик" pressed in "Настройки" → at once the boy forms in "Опрос" (question and answer), in
//   "План" (word rows and the theme title «Я готова!» → «Я готов!»), on "Слово" (opened from "План")
//   and the gender line of "Как"; the word numbers and the progress stay.
// Not here (developer): what the press writes and which session it keeps ->
// src/state/appStore.settings.test.ts "Кто учится"; each screen on its own with a stored gender ->
// src/features/plan/PlanScreen.test.tsx "gender change…", src/features/help/HelpScreen.test.tsx;
// the forms of the course data -> src/domain/course.test.ts.
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import common from '../../i18n/locales/ru/common.json'
import help from '../../i18n/locales/ru/help.json'
import plan from '../../i18n/locales/ru/plan.json'
import quiz from '../../i18n/locales/ru/quiz.json'
import settings from '../../i18n/locales/ru/settings.json'
import word from '../../i18n/locales/ru/word.json'
import { realCourses } from '../../test/realCourses'
import { renderApp } from '../../test/renderApp'

/** Kids word 60 (number 61, theme 9): «Skończyłam!» / «Я закончила!», boy «Skończyłem!» / «Я закончил!». */
const WORD = 60
/** Theme 52 of the kids course is «Я готова!» for a girl, «Я готов!» for a boy. */
const READY_THEME = 52

const openTab = (name: string) => {
  fireEvent.click(screen.getByRole('tab', { name }))
}
const themeTitle = (n: number) =>
  screen.getByText(plan.theme.replace('{{n}}', String(n))).closest('summary')

describe('"Кто учится": "Мальчик" changes every tab at once', () => {
  it('quiz, plan, word and "Как" take the boy forms; numbers and progress stay', async () => {
    const { ls, store } = await renderApp({
      storage: { course: '"kids"', done: JSON.stringify([WORD]) },
      path: '/settings',
      loadCourse: realCourses,
    })
    expect(store.getState().words[WORD]?.pl).toBe('Skończyłam!')

    fireEvent.click(screen.getByRole('button', { name: settings.kid.kids.boy }))

    openTab(common.tabs.quiz)
    expect(screen.getByText('Я закончил!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: quiz.showAnswer }))
    expect(screen.getByText('Skończyłem!')).toBeInTheDocument()

    openTab(common.tabs.plan)
    expect(themeTitle(READY_THEME)).toHaveTextContent('Я готов!')
    expect(screen.queryByText('Я готова!')).toBeNull()
    expect(screen.queryByText('Skończyłam!')).toBeNull()
    const row = screen.getByText('Skończyłem!').closest('button')
    expect(row).toHaveTextContent(`${String(WORD + 1)}Skończyłem!Я закончил!✓`)

    fireEvent.click(row ?? document.body)
    expect(
      screen.getByText(
        word.meta.position.replace('{{n}}', String(WORD + 1)).replace('{{total}}', '500'),
      ),
    ).toBeInTheDocument()
    expect(
      within(document.querySelector('.card.word') ?? document.body).getByText('Skończyłem!'),
    ).toBeInTheDocument()

    openTab(common.tabs.help)
    expect(screen.getByText(help.tips.gender.kids.boy)).toBeInTheDocument()
    expect(screen.queryByText(help.tips.gender.kids.girl)).toBeNull()

    expect(ls.snapshot().done).toBe(JSON.stringify([WORD]))
  })
})
