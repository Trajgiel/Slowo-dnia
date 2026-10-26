// Bottom tabs (materials/project/APP_SPEC.md → "8.2. Стиль", "8.3. Доступность"): a fixed bar, five
// columns, the prototype's stroke icons; tabs are buttons with role="tab" and aria-selected.
import type { ReactNode } from 'react'
import { TAB_NAMES, type TabName } from '../../domain'
import './TabBar.css'

const ICONS: Readonly<Record<TabName, ReactNode>> = {
  word: <path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zm0 0a2 2 0 0 1 2-2h12" />,
  quiz: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  help: (
    <>
      <path d="M12 7v.01M11 11h1v6h1" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
}

export interface TabBarProps {
  /** Accessible name of the tab list. */
  readonly label: string
  readonly tabLabels: Readonly<Record<TabName, string>>
  /** Selected tab; `null` — none. */
  readonly active: TabName | null
  readonly onSelect: (tab: TabName) => void
}

export function TabBar({ label, tabLabels, active, onSelect }: TabBarProps) {
  return (
    <nav className="tabbar" role="tablist" aria-label={label}>
      <div className="tabbar__in">
        {TAB_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            className="tabbar__tab"
            aria-selected={name === active}
            onClick={() => {
              onSelect(name)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {ICONS[name]}
            </svg>
            {tabLabels[name]}
          </button>
        ))}
      </div>
    </nav>
  )
}
