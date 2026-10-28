// "План" tab (analyst/features/react-port/us-5-plan-help.md → "План"; materials/project/APP_SPEC.md → "6.3. План"):
// the course's themes as `<details>` with a learned counter, the words inside with their number, a "✓"
// for learned ones and the current word marked. A press on a word opens it on "Слово" (a new history
// step). Open themes live in the store's session, so they survive tab changes and gender changes.
// Each theme subscribes to its own marks and open state: one "Выучили" draws one theme again, not 1000 rows.
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { tabPath, type Word } from '../../domain'
import { scrollIntoCenter } from '../../platform'
import { useAppActions, useCurrentWord, useLearnedMarks, useThemeOpen, useWords } from '../../state'
import './PlanScreen.css'

/** A theme: its index and the range of its words in the flat list. */
interface ThemeRange {
  readonly ti: number
  readonly from: number
  readonly to: number
}

/** Themes in course order; the words of a theme follow each other in the flat list. */
function themeRanges(words: readonly Word[]): ThemeRange[] {
  const ranges: ThemeRange[] = []
  words.forEach((word, i) => {
    const last = ranges.at(-1)
    if (last?.ti === word.ti) ranges[ranges.length - 1] = { ...last, to: i + 1 }
    else ranges.push({ ti: word.ti, from: i, to: i + 1 })
  })
  return ranges
}

interface ThemeProps {
  readonly range: ThemeRange
  readonly words: readonly Word[]
  /** The current word if it is in this theme, else `null`. */
  readonly cur: number | null
  readonly onOpenWord: (index: number) => void
}

const Theme = memo(function Theme({ range, words, cur, onOpenWord }: ThemeProps) {
  const { t } = useTranslation('plan')
  const { setThemeOpen } = useAppActions()
  const open = useThemeOpen(range.ti)
  const marks = useLearnedMarks(range.from, range.to)
  const learned = marks.split('1').length - 1
  const total = range.to - range.from
  const title = words[range.from]?.theme ?? ''

  const items: ReactNode[] = []
  for (let i = range.from; i < range.to; i++) {
    const word = words[i]
    if (!word) continue
    items.push(
      <li key={i}>
        <button
          type="button"
          className={i === cur ? 'item cur' : 'item'}
          onClick={() => {
            onOpenWord(i)
          }}
        >
          <span className="n">{i + 1}</span>
          <span className="w">
            <b lang="pl">{word.pl}</b>
            <span>{word.ru}</span>
          </span>
          <span className="ck">{marks[i - range.from] === '1' ? t('marked') : ''}</span>
        </button>
      </li>,
    )
  }

  return (
    <details
      open={open}
      onToggle={(e) => {
        setThemeOpen(range.ti, e.currentTarget.open)
      }}
    >
      <summary>
        <span className="wk">{t('theme', { n: range.ti + 1 })}</span>
        <span className="th">{title}</span>
        <span className={learned === total ? 'cnt full' : 'cnt'}>
          {t('count', { learned, total })}
        </span>
      </summary>
      <ol>{items}</ol>
    </details>
  )
})

export function PlanScreen() {
  const { t } = useTranslation('plan')
  const words = useWords()
  const cur = useCurrentWord()
  const { showWord } = useAppActions()
  const navigate = useNavigate()
  const navigationKey = useLocation().key
  const listRef = useRef<HTMLDivElement>(null)
  const ranges = useMemo(() => themeRanges(words), [words])

  // Every opening of the tab, also a repeated press: the current word to the middle of the screen
  // (architecture/react-port/routing.md → "Прокрутка"). The tab layout does not scroll "План" to the top.
  useEffect(() => {
    const item = listRef.current?.querySelector('.item.cur')
    if (item) scrollIntoCenter(item)
  }, [navigationKey])

  const openWord = useCallback(
    (index: number) => {
      showWord(index)
      void navigate(tabPath('word'))
    },
    [showWord, navigate],
  )

  return (
    <section className="view">
      <h2>{t('title')}</h2>
      <p className="lead">{t('lead')}</p>
      <div className="plan" ref={listRef}>
        {ranges.map((range) => (
          <Theme
            key={range.ti}
            range={range}
            words={words}
            cur={cur >= range.from && cur < range.to ? cur : null}
            onOpenWord={openWord}
          />
        ))}
      </div>
    </section>
  )
}
