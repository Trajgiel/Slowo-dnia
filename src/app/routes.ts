// Routes (architecture/react-port/routing.md → "Маршруты"): one per tab under the course gate; an empty or
// unknown address shows "Слово" and becomes `#/word` without a new history step. Tab paths are
// case-sensitive, as the prototype's `#word` match was.
import { createElement, type ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { TAB_NAMES, type TabName } from '../domain'
import { HelpScreen, PlanScreen, QuizScreen, SettingsScreen, WordScreen } from '../features'
import { AppShell } from './AppShell'
import { tabPath } from './routing/tabPath'

const TAB_SCREENS: Readonly<Record<TabName, ComponentType>> = {
  word: WordScreen,
  quiz: QuizScreen,
  plan: PlanScreen,
  help: HelpScreen,
  settings: SettingsScreen,
}

const toWord = createElement(Navigate, { to: tabPath('word'), replace: true })

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: createElement(AppShell),
    children: [
      { index: true, element: toWord },
      ...TAB_NAMES.map((name): RouteObject => ({
        path: name,
        caseSensitive: true,
        element: createElement(TAB_SCREENS[name]),
      })),
      { path: '*', element: toWord },
    ],
  },
]
