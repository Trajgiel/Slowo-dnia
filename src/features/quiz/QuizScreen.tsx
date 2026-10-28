// "Опрос" tab (analyst/features/react-port/us-3-quiz-deck.md, us-4-quiz-free.md; materials/project/APP_SPEC.md
// → "6.2. Опрос"): mode and direction switches (the direction and the "вперемешку" plate share one grid
// cell, so nothing moves), the lead with a reserved height, the card of the mode and the line under it.
// What to ask is decided by the store (`syncQuiz`); the screen only shows it. Every press hides the speech
// message, as the prototype's `renderQuiz` does.
import { useTranslation } from 'react-i18next'
import type { QuizDir, QuizMode } from '../../domain'
import { Segmented } from '../../shared/ui'
import { useAppActions, useDone, useQuizDir, useQuizMode } from '../../state'
import { SpeechMessage, useSpeech } from '../speech'
import { DeckQuiz } from './DeckQuiz'
import { FreeQuiz } from './FreeQuiz'
import './QuizScreen.css'

export function QuizScreen() {
  const { t } = useTranslation('quiz')
  const mode = useQuizMode()
  const dir = useQuizDir()
  const done = useDone()
  const { setQuizMode, setQuizDir } = useAppActions()
  const speech = useSpeech()
  const deck = mode === 'deck'

  /** Runs a press and hides the speech message. */
  const press =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A) => {
      speech.clear()
      action(...args)
    }

  return (
    <section className="view">
      <h2>{t('title')}</h2>
      <Segmented<QuizMode>
        label={t('mode.label')}
        options={[
          { value: 'deck', label: t('mode.deck') },
          { value: 'free', label: t('mode.free') },
        ]}
        value={mode}
        onChange={press(setQuizMode)}
      />
      <div className="dirwrap">
        <Segmented<QuizDir>
          label={t('dir.label')}
          options={[
            { value: 'ru', label: t('dir.ru') },
            { value: 'pl', label: t('dir.pl') },
          ]}
          value={dir}
          onChange={press(setQuizDir)}
          hidden={!deck}
        />
        <div className={deck ? 'seg segnote inv' : 'seg segnote'} aria-hidden={deck || undefined}>
          {t('dir.mixed')}
        </div>
      </div>
      <p className="lead quizlead">{deck ? t('lead.deck') : t('lead.free')}</p>
      {done.size === 0 ? (
        <>
          <div className="card empty">
            <b>{t('empty.title')}</b>
            <span>{t('empty.text')}</span>
          </div>
          <div className="quizbelow" />
        </>
      ) : deck ? (
        <DeckQuiz press={press} onSpeak={speech.say} />
      ) : (
        <FreeQuiz press={press} onSpeak={speech.say} />
      )}
      <SpeechMessage result={speech.result} />
    </section>
  )
}
