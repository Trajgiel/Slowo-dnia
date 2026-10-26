// Root route: the course gate (architecture/react-port/routing.md → "Ворота курса"). Until the course is
// ready the address does not matter: the start screen, the "course did not load" screen or only the page
// background; then the tabs. The toast is on every screen.
import { useTranslation } from 'react-i18next'
import { CourseErrorScreen, StartScreen } from '../features'
import { Toast } from '../shared/ui'
import { useGate, useToast } from '../state'
import { TabsLayout } from './TabsLayout'

function AppToast() {
  const { t } = useTranslation()
  const toast = useToast()
  return <Toast text={toast ? t(`toast.${toast.id}`) : ''} seq={toast?.seq ?? 0} />
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
