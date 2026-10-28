// "Колода" (analyst/features/react-port/us-3-quiz-deck.md → "Колода"): the question card with
// "Карточка n из N" and the score, or the solved deck in a card of the same height; under the card the
// last result and "Начать колоду заново" (pressed twice), or under a solved deck the previous result.
import { Trans, useTranslation } from 'react-i18next'
import { deckState, deckSummary, formatDayMonth, type DeckResult } from '../../domain'
import { TwoStepButton } from '../../shared/ui'
import {
  useAnswerShown,
  useAppActions,
  useDeck,
  useDeckResults,
  useDone,
  useQuizDir,
  useWords,
} from '../../state'
import { QuestionCard } from './QuestionCard'
import type { QuizModeProps } from './types'

function ResultLine({ result }: { readonly result: DeckResult | null }) {
  const { t } = useTranslation('quiz')
  if (!result) return null
  const values = { right: result.right, total: result.total, wrong: result.wrong }
  const date = formatDayMonth(result.date)
  return (
    <div className="msg">
      {date ? t('deck.last', { ...values, date }) : t('deck.lastNoDate', values)}
    </div>
  )
}

export function DeckQuiz({ press, onSpeak }: QuizModeProps) {
  const { t } = useTranslation('quiz')
  const dir = useQuizDir()
  const deck = useDeck()
  const results = useDeckResults()
  const done = useDone()
  const words = useWords()
  const answerShown = useAnswerShown()
  const { showAnswer, answerQuiz, restartDeck } = useAppActions()

  if (!deck) {
    return (
      <>
        <div className="card quiz" />
        <div className="quizbelow" />
      </>
    )
  }
  const state = deckState(deck, done)
  const dirLabel = dir === 'ru' ? t('dir.ru') : t('dir.pl')

  if (state.next === undefined) {
    const summary = deckSummary(state, done.size)
    return (
      <>
        <div className="card quiz result">
          <div className="ask">{dirLabel}</div>
          <div className="qmid">
            <p className="q">
              {summary.verdict === 'perfect' ? t('deck.solvedPerfect') : t('deck.solved')}
            </p>
            <div className="rstats">
              <div className="stat ok">
                <b>{state.right}</b>
                <span>{t('deck.tile.right')}</span>
              </div>
              <div className="stat bad">
                <b>{state.wrong}</b>
                <span>{t('deck.tile.wrong')}</span>
              </div>
              <div className="stat">
                <b>{state.total}</b>
                <span>{t('deck.tile.total')}</span>
              </div>
            </div>
            <div className="msg">
              {summary.verdict === 'perfect'
                ? t('deck.result.perfect')
                : summary.verdict === 'great'
                  ? t('deck.result.great', { pct: summary.pct })
                  : t('deck.result.retry', { pct: summary.pct })}
            </div>
          </div>
          <div className="qbot">
            <button type="button" className="primary full" onClick={press(restartDeck)}>
              {t('deck.again')}
            </button>
            {/* The line keeps its height when empty (the prototype puts a no-break space there). */}
            <div className="score">
              {summary.nextDeckSize === null
                ? '\u00a0'
                : t('deck.nextSize', { count: summary.nextDeckSize })}
            </div>
          </div>
        </div>
        <div className="quizbelow">
          <ResultLine result={results.prev} />
        </div>
      </>
    )
  }

  const word = words[state.next]
  const answeredCount = state.right + state.wrong
  return (
    <>
      {word ? (
        <QuestionCard
          word={word}
          dir={dir}
          top={t('deck.card', { n: answeredCount + 1, total: state.total })}
          bottom={
            <Trans
              t={t}
              i18nKey="deck.score"
              values={{ right: state.right, total: state.total, wrong: state.wrong }}
              components={{ ok: <b className="okc" />, bad: <b className="badc" /> }}
            />
          }
          answerShown={answerShown}
          onShowAnswer={press(showAnswer)}
          onAnswer={press(answerQuiz)}
          onSpeak={() => {
            onSpeak(word.pl)
          }}
        />
      ) : (
        <div className="card quiz" />
      )}
      <div className="quizbelow">
        <ResultLine result={results.last} />
        {answeredCount > 0 ? (
          // A new key after every answer and per direction: the warning does not outlive a redraw,
          // as in the prototype, where the button is made anew on every draw.
          <TwoStepButton
            key={`${dir}-${String(answeredCount)}-${String(answerShown)}`}
            className="ghost"
            label={t('deck.restart')}
            armedLabel={t('deck.restartConfirm')}
            onConfirm={press(restartDeck)}
          />
        ) : null}
      </div>
    </>
  )
}
