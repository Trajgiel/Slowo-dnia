import { isTabName, type TabName } from './settings'

/** Address path of a tab: `quiz` → `/quiz`. */
export const tabPath = (tab: TabName): string => `/${tab}`

/** The tab of a router path (`/quiz` → `quiz`); `null` — not a tab (the router sends it to `/word`). */
export function tabFromPath(pathname: string): TabName | null {
  const name = pathname.replace(/^\/+|\/+$/g, '')
  return isTabName(name) ? name : null
}
