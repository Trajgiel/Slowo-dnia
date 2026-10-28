// "Резервная копия прогресса" and "Начать заново" cards of "Настройки" (analyst/features/react-port/
// us-7-backup-reset.md; materials/project/APP_SPEC.md → "6.5. Настройки", cards 5–6, "7"). The field text
// and the status line live in the store session (they reset on course change); restore and reset are
// pressed twice (`TwoStepButton`: the timer is in the button, leaving the tab cancels the warning).
import { useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { CourseId } from '../../domain'
import { canShare, copyText, shareText } from '../../platform'
import { TwoStepButton } from '../../shared/ui'
import { useAppActions, useBackupCode, useBackupStatus, type BackupStatus } from '../../state'

const useTexts = () => useTranslation(['settings', 'common']).t
type Texts = ReturnType<typeof useTexts>

/** Full course name as in the prototype (`COURSES.<course>.name`): "Детский курс", "Курс для взрослых". */
const courseName = (t: Texts, course: CourseId): string =>
  course === 'adult' ? t('common:course.adult') : t('common:course.kids')

/** Dictionary text of the status line; keys are written out, so the dictionary check sees them. */
function statusText(t: Texts, status: BackupStatus | null): string {
  const name = (course: CourseId) => courseName(t, course)
  if (status === null) return ''
  switch (status.id) {
    case 'codeInField':
      return t('backup.status.codeInField')
    case 'copied':
      return t('backup.status.copied', { course: name(status.course), count: status.count })
    case 'selectAndCopy':
      return t('backup.status.selectAndCopy')
    case 'unreadable':
      return t('backup.status.unreadable')
    case 'otherCourse':
      return t('backup.status.otherCourse', { other: name(status.other) })
    case 'noProgress':
      return t('backup.status.noProgress', { course: name(status.course) })
    case 'restored':
      return t('backup.status.restored', { course: name(status.course), count: status.count })
  }
}

const shareTitle = (t: Texts, course: CourseId): string =>
  course === 'adult' ? t('backup.shareTitle.adult') : t('backup.shareTitle.kids')

export function BackupCard({ course }: { course: CourseId }) {
  const t = useTexts()
  const code = useBackupCode()
  const status = useBackupStatus()
  const { setBackupCode, copyBackupCode, exportBackupCode, restoreBackup } = useAppActions()
  const field = useRef<HTMLTextAreaElement>(null)
  // Without the system "Поделиться" the button is not there and "Скопировать код" takes the whole row.
  const shareable = canShare()

  const copy = async () => {
    const copied = await copyBackupCode(copyText)
    if (!copied) {
      field.current?.focus()
      field.current?.select()
    }
  }

  const share = () => {
    // Called straight from the press: the browser opens "Поделиться" only on a user action.
    const text = exportBackupCode()
    if (text !== null) void shareText({ title: shareTitle(t, course), text })
  }

  return (
    <div className="card help">
      <div>
        <h3>{t('backup.title')}</h3>
        <p className="msg">{t('backup.lead')}</p>
        <p className="msg">
          <Trans
            t={t}
            i18nKey="backup.course"
            values={{ course: courseName(t, course) }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <div className={shareable ? 'row2' : 'row2 one'}>
        <button type="button" onClick={() => void copy()}>
          {t('backup.copy')}
        </button>
        {shareable && (
          <button type="button" onClick={share}>
            {t('backup.share')}
          </button>
        )}
      </div>
      <textarea
        ref={field}
        className="code"
        rows={3}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label={t('backup.codeLabel')}
        placeholder={t('backup.codePlaceholder')}
        value={code}
        onChange={(event) => {
          setBackupCode(event.target.value)
        }}
      />
      <TwoStepButton
        className="primary full"
        label={t('backup.restore')}
        armedLabel={t('backup.restoreConfirm')}
        onConfirm={restoreBackup}
      />
      <div className="msg" role="status">
        {statusText(t, status)}
      </div>
    </div>
  )
}

export function ResetCard({ course }: { course: CourseId }) {
  const t = useTexts()
  const { resetProgress } = useAppActions()
  return (
    <div className="card help">
      <div>
        <h3>{t('reset.title')}</h3>
        <p className="msg">
          <Trans
            t={t}
            i18nKey="reset.hint"
            values={{ course: courseName(t, course) }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <TwoStepButton
        className="danger full"
        label={t('reset.button')}
        armedLabel={t('reset.confirm')}
        onConfirm={resetProgress}
      />
    </div>
  )
}
