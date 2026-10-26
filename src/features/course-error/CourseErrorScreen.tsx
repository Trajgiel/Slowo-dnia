// "The adult course did not load" at start (analyst/features/react-port/us-1-start.md → "Взрослый курс не
// загрузился при запуске"; architecture/react-port/course-data.md → "Ошибка загрузки (П-6)"). One button:
// a new request after a network error; a page reload when the file is gone or broken.
import { useTranslation } from 'react-i18next'
import { retryNeedsReload } from '../../data'
import { reloadPage } from '../../platform'
import { useAppActions, useCourseLoad } from '../../state'
import './CourseErrorScreen.css'

export function CourseErrorScreen() {
  const { t } = useTranslation(['start', 'common'])
  const { error } = useCourseLoad()
  const { retryCourse } = useAppActions()

  const retry = () => {
    if (error !== null && retryNeedsReload(error)) reloadPage()
    else void retryCourse()
  }

  return (
    <section className="view">
      <h1>{t('common:appName')}</h1>
      <p className="course-error__text">{t('adultFailed.text')}</p>
      <button type="button" className="primary full" onClick={retry}>
        {t('adultFailed.retry')}
      </button>
    </section>
  )
}
