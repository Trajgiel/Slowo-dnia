// "Слово" tab (analyst/features/react-port/us-2-word.md; materials/project/APP_SPEC.md → "6.1. Слово (главная)"):
// the word card, "Послушать", ← · Выучили · →, "Вернуться к новому слову", the progress card and the
// speech message. Texts of the course are data, shown as JSX text; the Polish word is marked `lang="pl"`.
import { useTranslation } from 'react-i18next'
import { nextIdx } from '../../domain'
import { useAppActions, useCurrentWord, useDone, useWords } from '../../state'
import { SpeechMessage, useSpeech } from '../speech'
import { CourseHeader } from './CourseHeader'
import { ProgressCard } from './ProgressCard'
import './WordScreen.css'

export function WordScreen() {
  const { t } = useTranslation(['word', 'common'])
  const words = useWords()
  const done = useDone()
  const cur = useCurrentWord()
  const { showWord, toggleLearned } = useAppActions()
  const speech = useSpeech()

  const total = words.length
  const word = words[cur]
  if (!word) {
    return (
      <section className="view">
        <CourseHeader />
      </section>
    )
  }

  const learned = done.has(cur)
  const atNew = cur === nextIdx(done, total)

  // Every action that shows a word again hides the speech message, as the prototype's `show()` does.
  const open = (index: number) => {
    speech.clear()
    showWord(index)
  }

  return (
    <section className="view">
      <CourseHeader />
      <div className="card word" aria-live="polite">
        <div className="meta">
          <span className="chip">{t('meta.position', { n: cur + 1, total })}</span>
          <span>{t('meta.theme', { n: word.ti + 1, theme: word.theme })}</span>
          {learned ? (
            <span className="badge ok">{t('badge.learned')}</span>
          ) : atNew ? (
            <span className="badge">{t('badge.new')}</span>
          ) : (
            <span className="badge inv" aria-hidden="true">
              ·
            </span>
          )}
        </div>
        <p className="pl" lang="pl">
          {word.pl}
        </p>
        <div className="tr">{`[${word.tr}]`}</div>
        <div className="ru">{word.ru}</div>
      </div>
      <button
        type="button"
        className="primary full"
        onClick={() => {
          speech.say(word.pl)
        }}
      >
        {t('common:speak')}
      </button>
      <div className="row3">
        <button
          type="button"
          aria-label={t('prev')}
          disabled={cur === 0}
          onClick={() => {
            open(cur - 1)
          }}
        >
          ←
        </button>
        <button
          type="button"
          className={learned ? 'isdone' : undefined}
          onClick={() => {
            speech.clear()
            toggleLearned()
          }}
        >
          {learned ? t('learned.marked') : t('learned.mark')}
        </button>
        <button
          type="button"
          aria-label={t('next')}
          disabled={cur === total - 1}
          onClick={() => {
            open(cur + 1)
          }}
        >
          →
        </button>
      </div>
      <button
        type="button"
        className={atNew ? 'ghost inv' : 'ghost'}
        tabIndex={atNew ? -1 : undefined}
        aria-hidden={atNew || undefined}
        onClick={() => {
          open(nextIdx(done, total))
        }}
      >
        {t('toNew')}
      </button>
      <ProgressCard onOpen={open} />
      <SpeechMessage result={speech.result} />
    </section>
  )
}
