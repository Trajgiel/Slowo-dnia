// Acceptance, SD-14 ("Опрос"), the whole app on the real kids course, from the stored settings to the
// screen and back to the storage.
// Covers (analyst/features/react-port/us-3-quiz-deck.md → "Общее для обоих режимов" in the workspace):
// - an unknown `qmode` / `qdir` in the storage: "Колода" and "Русский → польский" are shown and used
//   (an answer goes to `deck_ru` / `last_ru`, never to a key of the unknown value), and neither key is
//   rewritten (decisions/product/2026-10-25-v01-react-port.md → "Осознанные отличия от прототипа", п. 6).
// Not here: the storage reading rule alone -> src/storage/repo.test.ts "unknown qmode / qdir";
// the guards -> src/domain/deck.test.ts "quiz settings guards"; known values on the screen ->
// src/features/quiz/QuizScreen.test.tsx.
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import quiz from '../../i18n/locales/ru/quiz.json'
import { realCourses } from '../../test/realCourses'
import { renderApp } from '../../test/renderApp'

const pressed = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', { name })

describe('"Опрос": unknown stored mode and direction', () => {
  it('"Колода", Russian → Polish are used; the answer goes to deck_ru; qmode and qdir stay as stored', async () => {
    const stored = { course: '"kids"', done: '[2]', qmode: '"endless"', qdir: '"de"' }
    const { ls } = await renderApp({ storage: stored, path: '/quiz', loadCourse: realCourses })

    expect(pressed(quiz.mode.label, quiz.mode.deck)).toHaveAttribute('aria-pressed', 'true')
    expect(pressed(quiz.mode.label, quiz.mode.free)).toHaveAttribute('aria-pressed', 'false')
    expect(pressed(quiz.dir.label, quiz.dir.ru)).toHaveAttribute('aria-pressed', 'true')
    expect(pressed(quiz.dir.label, quiz.dir.pl)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(quiz.ask.ru)).toBeInTheDocument()
    // Word 2: "До свидания!" asked in Russian.
    expect(screen.getByText('До свидания!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: quiz.showAnswer }))
    fireEvent.click(screen.getByRole('button', { name: quiz.answer.yes }))
    expect(screen.getByText(quiz.deck.solvedPerfect)).toBeInTheDocument()

    const after = ls.snapshot()
    expect(after).toMatchObject({ qmode: '"endless"', qdir: '"de"' })
    expect(after.deck_ru).toBe('{"order":[2],"ans":{"2":true}}')
    expect(JSON.parse(after.last_ru ?? 'null')).toEqual({
      right: 1,
      wrong: 0,
      total: 1,
      date: '2026-10-26',
    })
    expect(Object.keys(after).filter((k) => /(deck|last|prev)_(?!ru$)/.test(k))).toEqual([])
  })
})
