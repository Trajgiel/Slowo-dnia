// Header of "Слово": the app name and the course chip that opens "Настройки"
// (materials/project/APP_SPEC.md → "6.1. Слово (главная)"; analyst/features/react-port/us-9-look.md → "Доступность").
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { tabPath } from '../../domain'
import { useCourse } from '../../state'
import './CourseHeader.css'

export function CourseHeader() {
  const { t } = useTranslation()
  const course = useCourse()
  const navigate = useNavigate()

  return (
    <div className="head">
      <h1>{t('appName')}</h1>
      {course && (
        <button
          type="button"
          className="coursechip"
          aria-label={t('courseChip.label')}
          onClick={() => {
            void navigate(tabPath('settings'))
          }}
        >
          {t(`course.${course}`)}
        </button>
      )}
    </div>
  )
}
