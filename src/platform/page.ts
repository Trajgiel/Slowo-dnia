// Page-level browser calls: reload and scroll (architecture/react-port/modules.md → "Платформа", "Прокрутка").

/** Reloads the page: the only fix when the course file of this version is gone or broken. */
export function reloadPage(win: Window = window): void {
  win.location.reload()
}

/** The browser does not restore scroll on "Назад" itself; the app scrolls on every tab change. */
export function disableScrollRestoration(win: Window = window): void {
  win.history.scrollRestoration = 'manual'
}

export function scrollToTop(win: Window = window): void {
  win.scrollTo(0, 0)
}

/** "План": the current word is scrolled to the middle of the screen, not to the top. */
export function scrollIntoCenter(element: Element): void {
  element.scrollIntoView({ block: 'center' })
}
