// Clipboard and system "Поделиться" (architecture/react-port/modules.md → "Платформа (platform)";
// prototype `bkCopy` / `bkShare`): whether the browser has them, and the outcome as a result, never an
// exception. Both need a secure page (HTTPS) and are called straight from a press.

/** The part of `navigator` the module uses; tests pass a stand-in. */
export interface ShareHost {
  readonly clipboard?: Pick<Clipboard, 'writeText'>
  readonly share?: (data: ShareData) => Promise<void>
}

const host = (): ShareHost | undefined => (typeof navigator === 'undefined' ? undefined : navigator)

/**
 * Puts `text` into the clipboard: `true` — copied; `false` — no clipboard, the browser refused or failed
 * (the prototype then selects the code in the field).
 */
export async function copyText(
  text: string,
  nav: ShareHost | undefined = host(),
): Promise<boolean> {
  try {
    if (!nav?.clipboard) return false
    await nav.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** The browser can open the system "Поделиться" (without it the "Отправить…" button is hidden). */
export const canShare = (nav: ShareHost | undefined = host()): boolean =>
  typeof nav?.share === 'function'

/**
 * Opens the system "Поделиться" with `title` and `text`. `false` — not opened, cancelled or failed:
 * the prototype shows nothing in any of these cases.
 */
export async function shareText(
  data: { readonly title: string; readonly text: string },
  nav: ShareHost | undefined = host(),
): Promise<boolean> {
  try {
    if (typeof nav?.share !== 'function') return false
    await nav.share({ title: data.title, text: data.text })
    return true
  } catch {
    return false
  }
}
