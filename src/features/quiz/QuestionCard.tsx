// The quiz question card of both modes (analyst/features/react-port/us-3-quiz-deck.md → "Общее для обоих
// режимов"): top line, the ask and the question, the answer that is always in the markup and only hidden
// until shown (so the card keeps its height), and the bottom with the buttons and the score line.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuizDir, Word } from '../../domain'

/** A question or answer longer than this gets the smaller font (prototype class `long`). */
export const LONG_TEXT = 24

const isLong = (text: string): boolean => text.length > LONG_TEXT

export interface QuestionCardProps {
  readonly word: Word
  /** `ru` — Russian → Polish, `pl` — Polish → Russian. */
  readonly dir: QuizDir
  readonly top: ReactNode
  readonly bottom: ReactNode
  readonly answerShown: boolean
  readonly onShowAnswer: () => void
  readonly onAnswer: (recalled: boolean) => void
  readonly onSpeak: () => void
}

export function QuestionCard({
  word,
  dir,
  top,
  bottom,
  answerShown,
  onShowAnswer,
  onAnswer,
  onSpeak,
}: QuestionCardProps) {
  const { t } = useTranslation(['quiz', 'common'])
  const ruFirst = dir === 'ru'
  const question = ruFirst ? word.ru : word.pl
  const answer = ruFirst ? word.pl : word.ru
  const qClass = isLong(question) ? 'q long' : 'q'
  const aClass = isLong(answer) ? 'a long' : 'a'
  const speakButton = (
    <button type="button" className="ghost" onClick={onSpeak}>
      {t('common:speak')}
    </button>
  )

  return (
    <div className="card quiz">
      <div className="ask">{top}</div>
      <div className="qmid">
        <div className="ask">{ruFirst ? t('ask.ru') : t('ask.pl')}</div>
        {ruFirst ? (
          <p className={qClass}>{question}</p>
        ) : (
          <>
            <p className={qClass} lang="pl">
              {question}
            </p>
            {speakButton}
          </>
        )}
        <div
          className={answerShown ? 'ans' : 'ans inv'}
          aria-hidden={answerShown ? undefined : true}
        >
          {ruFirst ? (
            <>
              <div className={aClass} lang="pl">
                {answer}
              </div>
              <div className="tr">{`[${word.tr}]`}</div>
              {speakButton}
            </>
          ) : (
            <div className={aClass}>{answer}</div>
          )}
        </div>
      </div>
      <div className="qbot">
        {answerShown ? (
          <div className="qbtns">
            <button
              type="button"
              onClick={() => {
                onAnswer(false)
              }}
            >
              {t('answer.no')}
            </button>
            <button
              type="button"
              className="isdone"
              onClick={() => {
                onAnswer(true)
              }}
            >
              {t('answer.yes')}
            </button>
          </div>
        ) : (
          <button type="button" className="primary full" onClick={onShowAnswer}>
            {t('showAnswer')}
          </button>
        )}
        <div className="score">{bottom}</div>
      </div>
    </div>
  )
}
