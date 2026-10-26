// Old prototype addresses (architecture/react-port/routing.md → "Старые адреса прототипа"):
// `#word`, `#quiz`, `#plan`, `#help`, `#settings` become `#/<name>` before the router is created, with no
// new history entry. The page path is kept (`…/index.html#quiz` → `…/index.html#/quiz`).
import { isTabName, type TabName } from '../../domain'

/** The tab of an old address hash (`#quiz` → `quiz`), exactly as the prototype matched it; else `null`. */
function legacyTab(hash: string): TabName | null {
  const name = hash.startsWith('#') ? hash.slice(1) : ''
  return isTabName(name) ? name : null
}

/** New address for an old one; `null` — the address is not an old one and stays as is. */
export function translateLegacyUrl(href: string): string | null {
  const url = new URL(href)
  const tab = legacyTab(url.hash)
  if (tab === null) return null
  url.hash = `/${tab}`
  return url.href
}

/** Rewrites the page address in place if it is an old one. */
export function migrateLegacyAddress(win: Window = window): void {
  const next = translateLegacyUrl(win.location.href)
  if (next !== null) win.history.replaceState(win.history.state, '', next)
}
