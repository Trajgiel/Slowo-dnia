// End-to-end, SD-12 (the toast), computed styles in the browser:
// - with "reduce motion" the toast only fades in, without the 10px shift
//   (decisions/product/2026-10-26-toast-reduced-motion.md (П-8) in the workspace);
// - without it, as in the prototype: fades in and moves up by 10px
//   (materials/project/APP_SPEC.md → "8.2. Стиль").
// Shown through a real failure: "🧑 Взрослый" on the course choice with no network.
// Not here: 3.5 s, showing the same text again -> src/shared/ui/Toast.test.tsx (developer); the toast is
// a live region -> src/app/AppShell.test.tsx (developer); token values (10px, .25s) ->
// src/app/styles/tokens.acceptance.test.ts.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import start from '../src/i18n/locales/ru/start.json' with { type: 'json' }
import { ADULT_COURSE_URL } from './support'

interface ToastStyle {
  /** Vertical offset of the transform, px. */
  readonly shiftY: number
  readonly transition: string[]
  readonly opacity: number
}

const toastStyle = (page: Page): Promise<ToastStyle> =>
  page.getByRole('status').evaluate((toast) => {
    const style = getComputedStyle(toast)
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
    return {
      shiftY: matrix.f,
      transition: style.transitionProperty.split(',').map((name) => name.trim()),
      opacity: Number(style.opacity),
    }
  })

async function showToast(page: Page): Promise<void> {
  await page.route(ADULT_COURSE_URL, (route) => route.abort('internetdisconnected'))
  await page.getByRole('button', { name: start.adult.title }).click()
  await expect(page.getByRole('status')).toHaveText(common.toast.courseLoadFailed)
}

test('reduced motion: the toast only fades in, no shift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')

  const hidden = await toastStyle(page)
  expect(hidden.opacity).toBe(0)
  expect(hidden.shiftY).toBe(0)
  expect(hidden.transition).toEqual(['opacity'])

  await showToast(page)
  await expect.poll(async () => (await toastStyle(page)).opacity).toBe(1)
  expect((await toastStyle(page)).shiftY).toBe(0)
})

test('normal motion: the toast fades in and moves up by 10px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')

  const hidden = await toastStyle(page)
  expect(hidden.opacity).toBe(0)
  expect(hidden.shiftY).toBe(10)
  expect(hidden.transition).toEqual(expect.arrayContaining(['opacity', 'transform']))

  await showToast(page)
  await expect.poll(async () => (await toastStyle(page)).opacity).toBe(1)
  await expect.poll(async () => (await toastStyle(page)).shiftY).toBe(0)
})
