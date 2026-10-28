// Root route: the course gate (architecture/react-port/routing.md → "Ворота курса"). Until the course is
// ready the address does not matter: the start screen, the "course did not load" screen or only the page
// background; then the tabs. The toast is on every screen.
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { CourseErrorScreen, StartScreen } from '../features'
import { Toast } from '../shared/ui'
import { useGate, useToast, type ToastMessage } from '../state'
import { TabsLayout } from './TabsLayout'

/** Dictionary text of a store toast. */
function toastText(t: TFunction<['common', 'word']>, message: ToastMessage): string {
  switch (message.id) {
    case 'courseLoadFailed':
      return t('toast.courseLoadFailed')
    case 'praiseAll':
      return t('word:praise.all', { total: message.total })
    case 'praiseTheme':
      return t('word:praise.theme', { theme: message.theme })
  }
}

function AppToast() {
  const { t } = useTranslation(['common', 'word'])
  const toast = useToast()
  return <Toast text={toast ? toastText(t, toast) : ''} seq={toast?.seq ?? 0} />
}

export function AppShell() {
  const gate = useGate()
  return (
    <>
      {gate === 'ready' ? (
        <TabsLayout />
      ) : (
        <main>
          {gate === 'choose' && <StartScreen />}
          {gate === 'failed' && <CourseErrorScreen />}
        </main>
      )}
      <AppToast />
    </>
  )
}
