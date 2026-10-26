// The app store (architecture/react-port/modules.md → "Состояние (state)"; decisions/stack/2026-10-26-state-zustand.md).
// One Zustand store made by a factory with its dependencies, so it is tested without React and without
// the page's localStorage. Every action writes exactly the keys the prototype writes at that moment,
// explicitly (architecture/react-port/storage.md → "Когда что пишется"); nothing is saved automatically.
import { createStore, type StoreApi } from 'zustand/vanilla'
import { CourseLoadError, type CourseLoadErrorKind, type LoadCourse } from '../data'
import {
  DEFAULT_GENDER,
  DEFAULT_QUIZ_DIR,
  DEFAULT_QUIZ_MODE,
  expandWords,
  INITIAL_FREE_QUIZ,
  nextIdx,
  prepareDeck,
  type CourseData,
  type CourseId,
  type DayKey,
  type Deck,
  type Done,
  type FreeQuizState,
  type Gender,
  type QuizDir,
  type QuizMode,
  type Rng,
  type TabName,
  type Theme,
  type Weak,
  type Word,
} from '../domain'
import type { DeckResults, StorageRepo } from '../storage'

export interface AppStoreDeps {
  readonly storage: StorageRepo
  readonly loadCourse: LoadCourse
  /** Current time (local dates of `days` and deck results). */
  readonly now: () => Date
  readonly rng: Rng
}

/**
 * What the app shows instead of the tabs while the course is not ready
 * (architecture/react-port/routing.md → "Ворота курса"):
 * `loading` — the course loads at start (only the page background); `choose` — the course choice;
 * `failed` — the adult course did not load at start; `ready` — the tabs.
 */
export type Gate = 'loading' | 'choose' | 'failed' | 'ready'

/** Loading of course data: what is loading or failed last, and why it failed. */
export interface CourseLoad {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly course: CourseId | null
  readonly error: CourseLoadErrorKind | null
}

/** Toast texts the store can show; the text is the dictionary key `common:toast.<id>`. */
export type ToastId = 'courseLoadFailed'
export const TOAST_IDS: readonly ToastId[] = ['courseLoadFailed']

export interface Toast {
  readonly id: ToastId
  /** Grows with every toast, so the same text shown again is a new toast. */
  readonly seq: number
}

/** What lives between tabs and is not stored; reset when the course changes. */
export interface Session {
  /** Word open on "Слово". */
  readonly cur: number
  /** The answer of the current deck card is shown. */
  readonly answerShown: boolean
  readonly free: FreeQuizState
}

export interface AppActions {
  /** Start-up: "old user" → course → loading → gate. Runs once; later calls do nothing. */
  start: () => Promise<void>
  /**
   * Course choice on the start screen and in "Настройки": loads the course; on success writes
   * `course`, opens it and reconciles the deck; on failure shows the toast and changes nothing.
   * `onLoaded` runs after the data has loaded and before the course is shown (the start screen moves
   * the address to `/word` there). A call while a course is loading does nothing and returns `false`.
   */
  selectCourse: (course: CourseId, onLoaded?: () => void | Promise<void>) => Promise<boolean>
  /**
   * "Попробовать ещё раз" on the "adult course did not load" screen: a new request; on failure the toast.
   * Does nothing while loading or outside that screen. Page reload for `not-found` / `invalid` is the
   * screen's job (`retryNeedsReload`).
   */
  retryCourse: () => Promise<void>
  /** A tab was opened (also by "Назад" / "Вперёд"): writes `tab`; the quiz reconciles the deck. */
  openTab: (tab: TabName) => void
  /** Deck reconciliation (prototype `renderDeck` side effect); see `architecture/react-port/storage.md`. */
  syncDeck: () => void
  showToast: (id: ToastId) => void
}

export interface AppState {
  readonly gate: Gate

  // Settings
  /** The open course; `null` until a course is ready. */
  readonly course: CourseId | null
  readonly theme: Theme
  readonly quizMode: QuizMode
  readonly quizDir: QuizDir

  // Course
  readonly courseData: CourseData | null
  readonly gender: Gender
  /** Flat word list for the gender (derived from the data and the gender). */
  readonly words: readonly Word[]

  // Progress
  readonly done: Done
  readonly weak: Weak
  readonly days: readonly DayKey[]

  // Decks
  readonly decks: Readonly<Record<QuizDir, Deck | null>>
  readonly deckResults: Readonly<Record<QuizDir, DeckResults>>

  // Course loading
  readonly courseLoad: CourseLoad

  // Session
  readonly session: Session
  readonly toast: Toast | null

  readonly actions: AppActions
}

export type AppStore = StoreApi<AppState>

const NO_RESULTS: DeckResults = { last: null, prev: null }

const newSession = (cur: number): Session => ({ cur, answerShown: false, free: INITIAL_FREE_QUIZ })

type LoadResult =
  | { readonly ok: true; readonly data: CourseData }
  | { readonly ok: false; readonly error: CourseLoadErrorKind }

export function createAppStore(deps: AppStoreDeps): AppStore {
  const { storage, rng } = deps
  let started = false

  return createStore<AppState>()((set, get) => {
    const isLoading = (): boolean => get().courseLoad.status === 'loading'

    /** `keepLoading`: on success the flag stays "loading" — the caller lowers it itself. */
    async function load(course: CourseId, keepLoading = false): Promise<LoadResult> {
      set({ courseLoad: { status: 'loading', course, error: null } })
      try {
        const data = await deps.loadCourse(course)
        if (!keepLoading) set({ courseLoad: { status: 'ready', course, error: null } })
        return { ok: true, data }
      } catch (error) {
        // The loader throws only CourseLoadError; anything else is treated as a network failure.
        const kind = error instanceof CourseLoadError ? error.kind : 'network'
        set({ courseLoad: { status: 'error', course, error: kind } })
        return { ok: false, error: kind }
      }
    }

    /** The course has loaded: `course` is written, its stored state is read, then the deck is reconciled. */
    function openCourse(course: CourseId, data: CourseData): void {
      storage.writeCourse(course)
      const stored = storage.readCourseState(course)
      const words = expandWords(data, stored.gender)
      set({
        course,
        courseData: data,
        gender: stored.gender,
        words,
        done: stored.done,
        weak: stored.weak,
        days: stored.days,
        decks: { ru: storage.readDeck(course, 'ru'), pl: storage.readDeck(course, 'pl') },
        deckResults: {
          ru: storage.readDeckResults(course, 'ru'),
          pl: storage.readDeckResults(course, 'pl'),
        },
        session: newSession(nextIdx(stored.done, words.length)),
      })
      get().actions.syncDeck()
    }

    const actions: AppActions = {
      async start() {
        if (started) return
        started = true
        set({
          theme: storage.readTheme(),
          quizMode: storage.readQuizMode(),
          quizDir: storage.readQuizDir(),
        })
        const course = storage.readStartCourse()
        if (course === null) {
          set({ gate: 'choose' })
          return
        }
        const result = await load(course)
        if (result.ok) {
          openCourse(course, result.data)
          set({ gate: 'ready' })
        } else {
          // Nothing is written: `course` stays "adult" (analyst/features/react-port/us-1-start.md).
          set({ gate: 'failed' })
        }
      },

      async selectCourse(course, onLoaded) {
        if (isLoading()) return false
        // The loading flag stays up until the course is open, so a press in this window is cut off.
        const result = await load(course, true)
        if (!result.ok) {
          get().actions.showToast('courseLoadFailed')
          return false
        }
        try {
          await onLoaded?.()
          openCourse(course, result.data)
          set({ gate: 'ready' })
        } finally {
          set({ courseLoad: { status: 'ready', course, error: null } })
        }
        return true
      },

      async retryCourse() {
        const { gate, courseLoad } = get()
        if (gate !== 'failed' || isLoading() || courseLoad.course === null) return
        const course = courseLoad.course
        const result = await load(course)
        if (result.ok) {
          openCourse(course, result.data)
          set({ gate: 'ready' })
        } else {
          get().actions.showToast('courseLoadFailed')
        }
      },

      openTab(tab) {
        storage.writeTab(tab)
        if (tab === 'quiz') get().actions.syncDeck()
      },

      syncDeck() {
        const { course, quizMode, quizDir, done, decks } = get()
        if (course === null || quizMode !== 'deck' || done.size === 0) return
        const prepared = prepareDeck(storage.readDeck(course, quizDir), done, rng)
        if (prepared.changed) storage.writeDeck(course, quizDir, prepared.deck)
        set({ decks: { ...decks, [quizDir]: prepared.deck } })
      },

      showToast(id) {
        set((state) => ({ toast: { id, seq: (state.toast?.seq ?? 0) + 1 } }))
      },
    }

    return {
      gate: 'loading',
      course: null,
      theme: 'dark',
      quizMode: DEFAULT_QUIZ_MODE,
      quizDir: DEFAULT_QUIZ_DIR,
      courseData: null,
      gender: DEFAULT_GENDER,
      words: [],
      done: new Set(),
      weak: {},
      days: [],
      decks: { ru: null, pl: null },
      deckResults: { ru: NO_RESULTS, pl: NO_RESULTS },
      courseLoad: { status: 'idle', course: null, error: null },
      session: newSession(0),
      toast: null,
      actions,
    }
  })
}
