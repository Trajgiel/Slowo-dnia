// "Настройки" tab (analyst/features/react-port/us-6-settings.md; materials/project/APP_SPEC.md →
// "6.5. Настройки"). Cards top to bottom: "Курс", "Кто учится", "Тема", "Установить как приложение",
// "Резервная копия прогресса", "Начать заново" (`BackupCards.tsx`), "Контакты", the copyright.
// Course, gender and theme come from the store; their actions write the storage.
import { Trans, useTranslation } from 'react-i18next'
import type { CourseId, Gender, Theme } from '../../domain'
import { Segmented } from '../../shared/ui'
import { useAppActions, useCourse, useGender, useTheme } from '../../state'
import { BackupCard, ResetCard } from './BackupCards'
import { LINKEDIN_URL, TELEGRAM_URL } from './contacts'
import { LinkedInIcon, TelegramIcon } from './icons'
import './SettingsScreen.css'

type SettingsT = ReturnType<typeof useTranslation<'settings'>>['t']

function CourseCard({ t, course }: { t: SettingsT; course: CourseId }) {
  const { selectCourse } = useAppActions()
  return (
    <div className="card help">
      <div>
        <h3>{t('course.title')}</h3>
        <p className="msg">{t('course.note')}</p>
      </div>
      <Segmented<CourseId>
        label={t('course.label')}
        options={[
          { value: 'kids', label: t('course.kids') },
          { value: 'adult', label: t('course.adult') },
        ]}
        value={course}
        onChange={(next) => {
          // The chosen course again does nothing; a failure shows the toast in the store.
          if (next !== course) void selectCourse(next)
        }}
      />
    </div>
  )
}

/** Gender buttons and hint of the course: keys are written out, so the dictionary check sees them. */
function genderTexts(t: SettingsT, course: CourseId): { hint: string; girl: string; boy: string } {
  return course === 'adult'
    ? { hint: t('kid.hint.adult'), girl: t('kid.adult.girl'), boy: t('kid.adult.boy') }
    : { hint: t('kid.hint.kids'), girl: t('kid.kids.girl'), boy: t('kid.kids.boy') }
}

function GenderCard({ t, course }: { t: SettingsT; course: CourseId }) {
  const gender = useGender()
  const { setGender } = useAppActions()
  const texts = genderTexts(t, course)
  return (
    <div className="card help">
      <div>
        <h3>{t('kid.title')}</h3>
        <p className="msg">{texts.hint}</p>
      </div>
      <Segmented<Gender>
        label={t('kid.label')}
        options={[
          { value: 'girl', label: texts.girl },
          { value: 'boy', label: texts.boy },
        ]}
        value={gender}
        onChange={setGender}
      />
    </div>
  )
}

function ThemeCard({ t }: { t: SettingsT }) {
  const theme = useTheme()
  const { setTheme } = useAppActions()
  return (
    <div className="card help">
      <div>
        <h3>{t('theme.title')}</h3>
      </div>
      <Segmented<Theme>
        label={t('theme.label')}
        options={[
          { value: 'dark', label: t('theme.dark') },
          { value: 'light', label: t('theme.light') },
        ]}
        value={theme}
        onChange={setTheme}
      />
    </div>
  )
}

function InstallCard({ t }: { t: SettingsT }) {
  const bold = { b: <b /> }
  return (
    <div className="card help">
      <div>
        <h3>{t('install.title')}</h3>
        <p className="msg">{t('install.lead')}</p>
      </div>
      <div>
        <h3>{t('install.ios.title')}</h3>
        <ol>
          <li>
            <Trans t={t} i18nKey="install.ios.1" components={bold} />
          </li>
          <li>{t('install.ios.2')}</li>
          <li>{t('install.ios.3')}</li>
          <li>{t('install.ios.4')}</li>
        </ol>
      </div>
      <div>
        <h3>{t('install.android.title')}</h3>
        <ol>
          <li>
            <Trans t={t} i18nKey="install.android.1" components={bold} />
          </li>
          <li>{t('install.android.2')}</li>
          <li>{t('install.android.3')}</li>
          <li>{t('install.android.4')}</li>
        </ol>
      </div>
      <p className="msg">{t('install.note')}</p>
    </div>
  )
}

function ContactsCard({ t }: { t: SettingsT }) {
  return (
    <div className="card help">
      <div>
        <h3>{t('contacts.title')}</h3>
      </div>
      <div className="contact">
        <a className="btn" href={TELEGRAM_URL} target="_blank" rel="noopener">
          <TelegramIcon />
          {t('contacts.telegram')}
        </a>
        <a className="btn" href={LINKEDIN_URL} target="_blank" rel="noopener">
          <LinkedInIcon />
          {t('contacts.linkedin')}
        </a>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const { t } = useTranslation('settings')
  // The tabs are shown only with a course open; kids is the prototype's default before that.
  const course = useCourse() ?? 'kids'
  return (
    <section className="view">
      <h2>{t('title')}</h2>
      <CourseCard t={t} course={course} />
      <GenderCard t={t} course={course} />
      <ThemeCard t={t} />
      <InstallCard t={t} />
      <BackupCard course={course} />
      <ResetCard course={course} />
      <ContactsCard t={t} />
      <p className="copy">
        <Trans
          t={t}
          i18nKey="copyright"
          components={{
            // The link text is the dictionary's <a>…</a> part (not <link>: a void HTML tag to the parser).
            a: <a href={LINKEDIN_URL} target="_blank" rel="noopener" />,
          }}
        />
      </p>
    </section>
  )
}
