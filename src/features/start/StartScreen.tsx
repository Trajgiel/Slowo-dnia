// Course choice on the first start (materials/project/APP_SPEC.md → "6.0. Выбор курса";
// analyst/features/react-port/us-1-start.md → "Экран выбора курса"). No tabs; the choice is not a history
// step: after the course loads the address becomes `#/word` by replacing the entry.
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { CourseId } from '../../domain'
import { useAppActions } from '../../state'
import './StartScreen.css'

interface CoursePickProps {
  readonly title: string
  readonly course: string
  readonly about: string
  readonly onPick: () => void
}

function CoursePick({ title, course, about, onPick }: CoursePickProps) {
  return (
    <button type="button" className="card pick" onClick={onPick}>
      <b>{title}</b>
      <span>{course}</span>
      <span className="msg">{about}</span>
    </button>
  )
}

export function StartScreen() {
  const { t } = useTranslation(['start', 'common'])
  const { selectCourse } = useAppActions()
  const navigate = useNavigate()

  const pick = (course: CourseId) => () => {
    void selectCourse(course, () => navigate('/word', { replace: true }))
  }

  return (
    <section className="view start">
      <h1>{t('common:appName')}</h1>
      <p className="lead">{t('lead')}</p>
      <CoursePick
        title={t('kids.title')}
        course={t('kids.course')}
        about={t('kids.about')}
        onPick={pick('kids')}
      />
      <CoursePick
        title={t('adult.title')}
        course={t('adult.course')}
        about={t('adult.about')}
        onPick={pick('adult')}
      />
      <p className="msg">{t('note')}</p>
    </section>
  )
}
