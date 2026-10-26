// Shared helpers of the end-to-end tests (qa).
import type { Page } from '@playwright/test'

/** Seeds raw `localStorage` once per test: the init script runs on every navigation of the page. */
export async function seedStorage(page: Page, items: Record<string, string>): Promise<void> {
  await page.addInitScript((data) => {
    // Also runs on about:blank, which has no storage.
    if (location.protocol !== 'http:') return
    if (sessionStorage.getItem('e2e-seeded') !== null) return
    sessionStorage.setItem('e2e-seeded', '1')
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value)
  }, items)
}

/** Uncaught page errors, collected for the whole test. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

/** The whole `localStorage` of the page as raw text per key. */
export function readStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const all: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null) all[key] = localStorage.getItem(key) ?? ''
    }
    return all
  })
}

/** The adult course file (src/data/loadCourse.ts: a hashed JSON asset). */
export const ADULT_COURSE_URL = '**/assets/adult-*.json'
