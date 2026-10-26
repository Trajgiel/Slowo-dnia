// The tabs: the open tab's screen and the bottom tab bar (architecture/react-port/routing.md →
// "Переключение вкладок и «Назад»", "Прокрутка"). Every address change — a tab press, "Назад", "Вперёд",
// the course chip — goes through the one effect below: it writes `tab` (and reconciles the quiz deck)
// and scrolls to the top, except on "План", which scrolls itself.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { TAB_NAMES, tabFromPath, tabPath, type TabName } from '../domain'
import { scrollToTop } from '../platform'
import { TabBar } from '../shared/ui'
import { useAppActions } from '../state'

export function TabsLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { openTab } = useAppActions()
  const tab = tabFromPath(location.pathname)
  // A new key on every navigation, also a repeated press of the open tab (replace).
  const navigationKey = location.key

  useEffect(() => {
    if (tab === null) return
    openTab(tab)
    if (tab !== 'plan') scrollToTop()
  }, [navigationKey, tab, openTab])

  const tabLabels = Object.fromEntries(
    TAB_NAMES.map((name) => [name, t(`tabs.${name}`)]),
  ) as Record<TabName, string>

  return (
    <>
      <main>
        <Outlet />
      </main>
      <TabBar
        label={t('tabs.label')}
        tabLabels={tabLabels}
        active={tab}
        onSelect={(name) => {
          // A press on the open tab adds no history step, so "Назад" does not get stuck on it.
          void navigate(tabPath(name), { replace: name === tab })
        }}
      />
    </>
  )
}
