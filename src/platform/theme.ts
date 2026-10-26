// Theme on the page (architecture/react-port/modules.md in the workspace, "Platform"):
// `data-theme` on <html> and <meta name="theme-color">. Before the first paint the inline
// script in index.html sets both; after that the store calls applyTheme on a theme change.
// This module does not read or write localStorage: the `theme` key belongs to the storage layer.

import type { Theme } from '../domain'

/** Browser bar color of each theme; equals --paper (design/system/README.md, "Colors"). */
export const THEME_COLOR: Readonly<Record<Theme, string>> = {
  dark: '#121826',
  light: '#f6f8fc',
}

/** Sets the theme on the page: `data-theme` on <html> and the `theme-color` meta tag. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme

  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = doc.createElement('meta')
    meta.name = 'theme-color'
    doc.head.append(meta)
  }
  meta.content = THEME_COLOR[theme]
}
