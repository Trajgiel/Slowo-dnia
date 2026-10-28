// The app store (architecture/react-port/modules.md → "Состояние (state)"; decisions/stack/2026-10-26-state-zustand.md).
// One Zustand store made by a factory with its dependencies, so it is tested without React and without
// the page's localStorage. Every action writes exactly the keys the prototype writes at that moment,
// explicitly (architecture/react-port/storage.md → "Когда что пишется"); nothing is saved automatically.
import { createStore, type StoreApi } from 'zustand/vanilla'
import { CourseLoadError, type CourseLoadErrorKind, type LoadCourse } from '../data'
import {
  answerDeck,
  createBackupCode,
  DEFAULT_GENDER,
  DEFAULT_QUIZ_DIR,
  DEFAULT_QUIZ_MODE,
  expandWords,
  deckState,
  INITIAL_FREE_QUIZ,
  markWeak,
  needsNextFree,
  newDeck,
  nextFree,
  nextIdx,
  praiseFor,
  prepareDeck,
  restoreBackupCode,
  toggleLearned as toggleDone,
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
import type { CourseProgress, DeckResults, StorageRepo } from '../storage'

export interface AppStoreDeps {
  readonly storage: StorageRepo
  readonly loadCourse: LoadCourse
  /** Current time (local dates of `days` and deck results). */
  readonly now: () => Date
  readonly rng: Rng
  /**
   * Puts the theme on the page (`platform/theme`): `data-theme` and the browser bar color. The app
   * passes `applyTheme`; tests may leave it out.
   */
  readonly applyTheme?: (theme: Theme) => void
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

/**
 * Toasts the store can show and the values of their texts; the app turns them into dictionary texts.
 * `praiseAll` / `praiseTheme` — praise after "Выучили" (materials/project/APP_SPEC.md → "6.1" → "Похвала").
 */
export type ToastMessage =
  | { readonly id: 'courseLoadFailed' }
  | { readonly id: 'praiseAll'; readonly total: number }
  | { readonly id: 'praiseTheme'; readonly theme: string }
  /** "Сбросить прогресс" confirmed. */
  | { readonly id: 'progressReset' }

export type ToastId = ToastMessage['id']

export type Toast = ToastMessage & {
  /** Grows with every toast, so the same text shown again is a new toast. */
  readonly seq: number
}

/**
 * Status line of "Резервная копия прогресса" (materials/project/APP_SPEC.md → "7"); the app turns it into
 * a dictionary text. `course` — the course the message is about (the open one when it was made).
 * `codeInField` — the code is in the field, the clipboard has not answered yet; `copied` — copied,
 * `count` learned words; `selectAndCopy` — no clipboard, the code is selected in the field;
 * `unreadable` — not an SD1 code or broken; `otherCourse` — a code of course `other`; `noProgress` — an
 * SD1 code of this course without progress inside; `restored` — restored, `count` learned words.
 */
export type BackupStatus =
  | { readonly id: 'codeInField' }
  | { readonly id: 'copied'; readonly course: CourseId; readonly count: number }
  | { readonly id: 'selectAndCopy' }
  | { readonly id: 'unreadable' }
  | { readonly id: 'otherCourse'; readonly other: CourseId }
  | { readonly id: 'noProgress'; readonly course: CourseId }
  | { readonly id: 'restored'; readonly course: CourseId; readonly count: number }

/** What lives between tabs and is not stored; reset when the course changes. */
export interface Session {
  /** Word open on "Слово". */
  readonly cur: number
  /** The answer of the quiz card is shown (deck and "Без конца"). */
  readonly answerShown: boolean
  /** "Без конца": current word (`idx`, `null` — none), its direction and recent words. */
  readonly free: FreeQuizState
  /**
   * Themes open on "План" (theme indices). Reset to the current word's theme whenever the session is
   * (start, course change, and later restore and reset); tab changes, marks and gender keep it.
   */
  readonly openThemes: ReadonlySet<number>
  /**
   * Text of the backup code field and the status line under it. Cleared with the session on course
   * change; restore keeps both (the status shows the result), reset keeps the field and clears the status.
   */
  readonly backupCode: string
  readonly backupStatus: BackupStatus | null
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
  /** A tab was opened (also by "Назад" / "Вперёд"): writes `tab`; the quiz is reconciled (`syncQuiz`). */
  openTab: (tab: TabName) => void
  /**
   * What the quiz shows is brought up to date, as the prototype's `renderQuiz` does on every draw:
   * in "Колода" the deck is reconciled (`architecture/react-port/storage.md` → "«Сверка колоды»"); in
   * "Без конца" a new question is picked if there is none or its word is no longer learned. One pick
   * per call: when no word can be picked (all weights not above zero) the question stays empty, no loop.
   */
  syncQuiz: () => void
  /** Quiz mode switch: writes `qmode`, hides the answer, reconciles the quiz. */
  setQuizMode: (mode: QuizMode) => void
  /** Deck direction switch: writes `qdir`, hides the answer, reconciles the quiz. */
  setQuizDir: (dir: QuizDir) => void
  /** "Показать ответ". */
  showAnswer: () => void
  /**
   * "Ответили ✓" (`recalled`) / "Не вспомнили". Deck: the answer and the weak counter are saved at once
   * (`done`, `weak`, `days`, then `deck_<dir>`; a solved deck moves `last` to `prev` and writes the new
   * `last`). "Без конца": only the weak counter (`done`, `weak`, `days`), then the next question.
   */
  answerQuiz: (recalled: boolean) => void
  /** "Начать колоду заново" (confirmed) and "Решить заново": a new deck of all learned words is written. */
  restartDeck: () => void
  /** "Другое слово": the next "Без конца" question, nothing is written. */
  skipFree: () => void
  /** "Тема" in "Настройки": writes `theme` and puts it on the page at once. */
  setTheme: (theme: Theme) => void
  /**
   * "Кто учится" in "Настройки": writes `P+kid`, the words take the gender's forms, then the deck is
   * reconciled. Word numbers, progress, the open word, open themes of "План" and the quiz stay.
   */
  setGender: (gender: Gender) => void
  /** A theme on "План" was opened or closed; nothing is written. */
  setThemeOpen: (theme: number, open: boolean) => void
  /** Opens word `index` on "Слово" (kept within the course). */
  showWord: (index: number) => void
  /**
   * "Выучили" on the open word: marks it (today's date joins `days`, praise toast) or removes the mark
   * (`days` stays). Writes `done`, `weak`, `days`; the open word does not move.
   */
  toggleLearned: () => void
  /** The backup code field was edited; nothing is written. */
  setBackupCode: (text: string) => void
  /**
   * "Отправить…": saves the progress (`done`, `weak`, `days`, as the prototype `save()`) and returns the
   * SD1 code of the open course; the field and the status do not change. `null` — no course open.
   */
  exportBackupCode: () => string | null
  /**
   * "Скопировать код": saves the progress, puts the code into the field (status "в поле ниже"), then
   * `copy` puts it into the clipboard: the status tells "скопирован" with the learned count, or — when
   * `copy` gives `false` — "выделен в поле" (the screen selects the field). Returns what `copy` gave.
   */
  copyBackupCode: (copy: (code: string) => Promise<boolean>) => Promise<boolean>
  /**
   * "Восстановить из кода" (confirmed) with the field's text. A code of this course replaces `done`,
   * `weak`, `days`, clears decks and results of both directions (`architecture/react-port/storage.md` →
   * "Когда что пишется"), reads the course again, opens a new session at the first unlearned word, keeps
   * the field and reconciles the deck. An unreadable code, a code of another course or one without
   * progress only sets the status; nothing is written.
   */
  restoreBackup: () => void
  /**
   * "Сбросить прогресс" (confirmed): the same writes as a restore with empty progress, the status is
   * cleared (the field stays), the toast, the first word.
   */
  resetProgress: () => void
  /** A new toast replaces the shown one and starts its time again. */
  showToast: (message: ToastMessage) => void
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

  /** The store's clock (local dates of the streak line); the same one the actions use. */
  readonly now: () => Date
  readonly actions: AppActions
}

export type AppStore = StoreApi<AppState>

const NO_RESULTS: DeckResults = { last: null, prev: null }

/** A new session opens word `cur`; on "План" only the theme of that word is open. */
const newSession = (cur: number, words: readonly Word[] = []): Session => {
  const theme = words[cur]?.ti
  return {
    cur,
    answerShown: false,
    free: INITIAL_FREE_QUIZ,
    openThemes: new Set(theme === undefined ? [] : [theme]),
    backupCode: '',
    backupStatus: null,
  }
}

const EMPTY_PROGRESS: CourseProgress = { done: [], weak: {}, days: [] }

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
        session: newSession(nextIdx(stored.done, words.length), words),
      })
      get().actions.syncQuiz()
    }

    /** Deck reconciliation (prototype `renderDeck` side effect): only in "Колода" with learned words. */
    function syncDeck(): void {
      const { course, quizMode, quizDir, done, decks } = get()
      if (course === null || quizMode !== 'deck' || done.size === 0) return
      const prepared = prepareDeck(storage.readDeck(course, quizDir), done, rng)
      if (prepared.changed) storage.writeDeck(course, quizDir, prepared.deck)
      set({ decks: { ...decks, [quizDir]: prepared.deck } })
    }

    /**
     * Restore and reset (prototype `writeCourse` + `reloadCourse`): the progress is written and decks and
     * results of both directions become `null`; the course state is read again (numbers outside the
     * course drop out), a new session opens at the first unlearned word with the given field and status,
     * then the deck is reconciled. Gender, theme, quiz mode and the other course stay.
     */
    function replaceProgress(
      course: CourseId,
      progress: CourseProgress,
      backup: Pick<Session, 'backupCode' | 'backupStatus'>,
    ): Done {
      storage.replaceCourse(course, progress)
      const stored = storage.readCourseState(course)
      const { words } = get()
      set({
        done: stored.done,
        weak: stored.weak,
        days: stored.days,
        decks: { ru: null, pl: null },
        deckResults: { ru: NO_RESULTS, pl: NO_RESULTS },
        session: { ...newSession(nextIdx(stored.done, words.length), words), ...backup },
      })
      get().actions.syncQuiz()
      return stored.done
    }

    const setBackupStatus = (backupStatus: BackupStatus | null): void => {
      set((state) => ({ session: { ...state.session, backupStatus } }))
    }

    /** Next "Без конца" question; the answer is hidden (prototype `nextFree`). */
    function pickNextFree(): void {
      const { done, weak, session } = get()
      set({
        session: { ...session, answerShown: false, free: nextFree(session.free, done, weak, rng) },
      })
    }

    /** "Без конца" on draw (prototype `renderFree`): a question is picked once if there is none. */
    function syncFree(): void {
      const { course, quizMode, done, session } = get()
      if (course === null || quizMode !== 'free' || done.size === 0) return
      if (needsNextFree(session.free, done)) pickNextFree()
    }

    const hideAnswer = (): void => {
      const { session } = get()
      if (session.answerShown) set({ session: { ...session, answerShown: false } })
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
          get().actions.showToast({ id: 'courseLoadFailed' })
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
          get().actions.showToast({ id: 'courseLoadFailed' })
        }
      },

      openTab(tab) {
        storage.writeTab(tab)
        if (tab === 'quiz') get().actions.syncQuiz()
      },

      syncQuiz() {
        syncDeck()
        syncFree()
      },

      setQuizMode(mode) {
        set({ quizMode: mode })
        storage.writeQuizMode(mode)
        hideAnswer()
        get().actions.syncQuiz()
      },

      setQuizDir(dir) {
        set({ quizDir: dir })
        storage.writeQuizDir(dir)
        hideAnswer()
        get().actions.syncQuiz()
      },

      showAnswer() {
        const { session } = get()
        if (!session.answerShown) set({ session: { ...session, answerShown: true } })
      },

      answerQuiz(recalled) {
        const { course, quizMode, quizDir, done, weak, days, decks, deckResults, session } = get()
        if (course === null) return
        if (quizMode === 'free') {
          if (session.free.idx === null) return
          const nextWeak = markWeak(weak, session.free.idx, recalled)
          set({ weak: nextWeak })
          storage.writeProgress(course, { done, weak: nextWeak, days })
          pickNextFree()
          return
        }
        const deck = decks[quizDir]
        if (!deck) return
        const word = deckState(deck, done).next
        const results = deckResults[quizDir]
        const answer = answerDeck(deck, done, recalled, results.last, deps.now())
        if (!answer.answered || word === undefined) return
        const nextWeak = markWeak(weak, word, recalled)
        storage.writeProgress(course, { done, weak: nextWeak, days })
        storage.writeDeck(course, quizDir, answer.deck)
        const { finished } = answer
        if (finished) {
          if (finished.prev) storage.writePrevResult(course, quizDir, finished.prev)
          storage.writeLastResult(course, quizDir, finished.last)
        }
        set({
          weak: nextWeak,
          decks: { ...decks, [quizDir]: answer.deck },
          deckResults: finished
            ? {
                ...deckResults,
                [quizDir]: { last: finished.last, prev: finished.prev ?? results.prev },
              }
            : deckResults,
          session: { ...session, answerShown: false },
        })
      },

      restartDeck() {
        const { course, quizDir, done, decks, session } = get()
        if (course === null) return
        const deck = newDeck(done, rng)
        storage.writeDeck(course, quizDir, deck)
        set({ decks: { ...decks, [quizDir]: deck }, session: { ...session, answerShown: false } })
        get().actions.syncQuiz()
      },

      skipFree() {
        if (get().course === null) return
        pickNextFree()
      },

      setTheme(theme) {
        set({ theme })
        storage.writeTheme(theme)
        deps.applyTheme?.(theme)
      },

      setGender(gender) {
        const { course, courseData } = get()
        if (course === null || courseData === null) return
        // Written on every press, as the prototype does; the same gender draws nothing new.
        storage.writeGender(course, gender)
        if (gender !== get().gender) set({ gender, words: expandWords(courseData, gender) })
        get().actions.syncQuiz()
      },

      setThemeOpen(theme, open) {
        const { session } = get()
        if (session.openThemes.has(theme) === open) return
        const openThemes = new Set(session.openThemes)
        if (open) openThemes.add(theme)
        else openThemes.delete(theme)
        set({ session: { ...session, openThemes } })
      },

      showWord(index) {
        const { words, session } = get()
        if (!words.length) return
        const cur = Math.min(words.length - 1, Math.max(0, Math.trunc(index)))
        if (cur !== session.cur) set({ session: { ...session, cur } })
      },

      toggleLearned() {
        const { course, words, done, weak, days, session } = get()
        if (course === null || !words.length) return
        const result = toggleDone(done, days, session.cur, deps.now())
        set({ done: result.done, days: result.days })
        storage.writeProgress(course, { done: result.done, weak, days: result.days })
        if (!result.learned) return
        const praise = praiseFor(words, result.done, session.cur)
        if (praise?.kind === 'all')
          get().actions.showToast({ id: 'praiseAll', total: praise.total })
        else if (praise?.kind === 'theme')
          get().actions.showToast({ id: 'praiseTheme', theme: praise.theme })
      },

      setBackupCode(text) {
        const { session } = get()
        if (session.backupCode !== text) set({ session: { ...session, backupCode: text } })
      },

      exportBackupCode() {
        const { course, done, weak, days } = get()
        if (course === null) return null
        // Prototype `exportCode`: `save()` first, then the code of what was saved.
        storage.writeProgress(course, { done, weak, days })
        return createBackupCode(course, { done: [...done].sort((a, b) => a - b), weak, days })
      },

      async copyBackupCode(copy) {
        const { course } = get()
        const code = get().actions.exportBackupCode()
        if (course === null || code === null) return false
        set((state) => ({
          session: { ...state.session, backupCode: code, backupStatus: { id: 'codeInField' } },
        }))
        const copied = await copy(code)
        // The course changed while the clipboard answered: the session (field, status) is a new one.
        if (get().course !== course) return copied
        setBackupStatus(
          copied ? { id: 'copied', course, count: get().done.size } : { id: 'selectAndCopy' },
        )
        return copied
      },

      restoreBackup() {
        const { course, session } = get()
        if (course === null) return
        const result = restoreBackupCode(session.backupCode, course)
        switch (result.kind) {
          case 'invalid':
            setBackupStatus({ id: 'unreadable' })
            return
          case 'otherCourse':
            setBackupStatus({ id: 'otherCourse', other: result.course })
            return
          case 'noProgress':
            setBackupStatus({ id: 'noProgress', course })
            return
          case 'restored': {
            // Numbers outside the course are written as the prototype writes them, but are not counted:
            // reading the course drops them (analyst/features/react-port/us-7-backup-reset.md).
            const done = replaceProgress(course, result.progress, {
              backupCode: session.backupCode,
              backupStatus: null,
            })
            setBackupStatus({ id: 'restored', course, count: done.size })
          }
        }
      },

      resetProgress() {
        const { course, session } = get()
        if (course === null) return
        replaceProgress(course, EMPTY_PROGRESS, {
          backupCode: session.backupCode,
          backupStatus: null,
        })
        get().actions.showToast({ id: 'progressReset' })
      },

      showToast(message) {
        set((state) => ({ toast: { ...message, seq: (state.toast?.seq ?? 0) + 1 } }))
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
      now: deps.now,
      actions,
    }
  })
}
