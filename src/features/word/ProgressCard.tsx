// Progress card of "Слово": learned / left / percent, the bar, the theme dots and the streak line
// (analyst/features/react-port/us-2-word.md → "Прогресс", "Серия дней").
import { useTranslation } from 'react-i18next'
import { percentLearned, streakLine, themeWordIndices } from '../../domain'
import { useClock, useCurrentWord, useDays, useDone, useWords } from '../../state'

export interface ProgressCardProps {
  /** A dot was pressed: open word `index`. */
  readonly onOpen: (index: number) => void
}

function StreakLine() {
  const { t } = useTranslation('word')
  const days = useDays()
  const now = useClock()
  const line = streakLine(days, now())
  if (line.kind === 'hidden') return null
  return (
    <div className="msg streak">
      {line.kind === 'start'
        ? t('streak.start')
        : line.today
          ? t('streak.days', { count: line.n })
          : t('streak.daysNotToday', { count: line.n })}
    </div>
  )
}

export function ProgressCard({ onOpen }: ProgressCardProps) {
  const { t } = useTranslation('word')
  const words = useWords()
  const done = useDone()
  const cur = useCurrentWord()
  const total = words.length
  const word = words[cur]
  if (!word) return null
  const dots = themeWordIndices(words, word.ti)

  return (
    <div className="card prog">
      <div className="stats">
        <div className="stat">
          <b>{done.size}</b>
          <span>{t('stats.learned')}</span>
        </div>
        <div className="stat">
          <b>{total - done.size}</b>
          <span>{t('stats.left')}</span>
        </div>
        <div className="stat">
          <b>{t('stats.percent', { value: percentLearned(done.size, total) })}</b>
          <span>{t('stats.passed')}</span>
        </div>
      </div>
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${String((done.size / total) * 100)}%` }} />
      </div>
      <div className="msg">{t('themeTitle', { n: word.ti + 1, theme: word.theme })}</div>
      <div
        className="weekdots"
        style={{ gridTemplateColumns: `repeat(${String(dots.length)}, minmax(0, 1fr))` }}
      >
        {dots.map((i) => {
          const current = i === cur
          return (
            <button
              key={i}
              type="button"
              className={
                [done.has(i) && 'd', current && 'c'].filter(Boolean).join(' ') || undefined
              }
              aria-label={t('dot', { n: i + 1, pl: words[i]?.pl ?? '' })}
              aria-current={current || undefined}
              onClick={() => {
                onOpen(i)
              }}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <StreakLine />
    </div>
  )
}
