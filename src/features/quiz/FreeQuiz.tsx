// "Без конца" (analyst/features/react-port/us-4-quiz-free.md): the question card with the direction on top
// and "Выучено n слов" at the bottom; "Другое слово" under it. When no word could be picked (every learned
// word weighs nothing), the card stays empty with its height and "Другое слово" tries again.
import { useTranslation } from 'react-i18next'
import { useAnswerShown, useAppActions, useDone, useFreeQuiz, useWords } from '../../state'
import { QuestionCard } from './QuestionCard'
import type { QuizModeProps } from './types'

export function FreeQuiz({ press, onSpeak }: QuizModeProps) {
  const { t } = useTranslation('quiz')
  const free = useFreeQuiz()
  const done = useDone()
  const words = useWords()
  const answerShown = useAnswerShown()
  const { showAnswer, answerQuiz, skipFree } = useAppActions()

  const word = free.idx !== null && done.has(free.idx) ? words[free.idx] : undefined
  return (
    <>
      {word ? (
        <QuestionCard
          word={word}
          dir={free.dir}
          top={free.dir === 'ru' ? t('dir.ru') : t('dir.pl')}
          bottom={t('free.learned', { count: done.size })}
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
        <button type="button" className="ghost" onClick={press(skipFree)}>
          {t('free.skip')}
        </button>
      </div>
    </>
  )
}
