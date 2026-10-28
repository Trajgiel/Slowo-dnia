// Hooks the components use; they select a part of the store and do not know its shape.
import { useContext } from 'react'
import { useStore } from 'zustand'
import type {
  CourseId,
  DayKey,
  Deck,
  Done,
  FreeQuizState,
  QuizDir,
  QuizMode,
  Word,
} from '../domain'
import type { DeckResults } from '../storage'
import type { AppActions, AppState, CourseLoad, Gate, Toast } from './appStore'
import { AppStoreContext } from './context'

function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider')
  return useStore(store, selector)
}

/** What to show instead of the tabs while the course is not ready. */
export const useGate = (): Gate => useAppStore((s) => s.gate)
/** The open course (`null` until a course is ready). */
export const useCourse = (): CourseId | null => useAppStore((s) => s.course)
export const useCourseLoad = (): CourseLoad => useAppStore((s) => s.courseLoad)
export const useToast = (): Toast | null => useAppStore((s) => s.toast)
/** Flat word list of the open course for the chosen gender. */
export const useWords = (): readonly Word[] => useAppStore((s) => s.words)
/** Learned words of the open course. */
export const useDone = (): Done => useAppStore((s) => s.done)
/** Local dates the streak counts. */
export const useDays = (): readonly DayKey[] => useAppStore((s) => s.days)
/** The word open on "Слово". */
export const useCurrentWord = (): number => useAppStore((s) => s.session.cur)
/** Quiz mode and deck direction (settings). */
export const useQuizMode = (): QuizMode => useAppStore((s) => s.quizMode)
export const useQuizDir = (): QuizDir => useAppStore((s) => s.quizDir)
/** Deck of the chosen direction (`null` — not made yet: nothing learned or another mode). */
export const useDeck = (): Deck | null => useAppStore((s) => s.decks[s.quizDir])
/** Last and previous results of the chosen direction. */
export const useDeckResults = (): DeckResults => useAppStore((s) => s.deckResults[s.quizDir])
/** The answer of the quiz card is shown. */
export const useAnswerShown = (): boolean => useAppStore((s) => s.session.answerShown)
/** "Без конца" question: word, direction, recent words. */
export const useFreeQuiz = (): FreeQuizState => useAppStore((s) => s.session.free)
/** The store's clock; the function never changes. */
export const useClock = (): (() => Date) => useAppStore((s) => s.now)
/** Store actions; the object never changes. */
export const useAppActions = (): AppActions => useAppStore((s) => s.actions)
