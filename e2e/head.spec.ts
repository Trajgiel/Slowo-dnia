// End-to-end, SD-11 (<head> of the page), on the production build as the browser parses it:
// - every <head> tag of the prototype (materials/project/APP_SPEC.md → "9. PWA" → "In <head>" in
//   the workspace): manifest, icon, apple-touch-icon, apple-mobile-web-app-capable,
//   mobile-web-app-capable, apple-mobile-web-app-title, apple-mobile-web-app-status-bar-style,
//   theme-color, viewport-fit=cover; the icons are served by the site;
// - the page title (architecture/react-port/pwa.md → "Manifest and page title");
// - US-12: author and copyright, as in the prototype (author tag; the comment in the page source).
// Not here: lang="ru" and the /Slowo-dnia/ base of every reference ->
// tests/skeleton-build.acceptance.test.ts (SD-6); the theme-color value per theme ->
// e2e/theme-before-paint.spec.ts; the manifest file itself -> tests/pwa-build.acceptance.test.ts.
import { expect, test } from '@playwright/test'

const meta = (name: string): string => `meta[name="${name}"]`

test('<head> has every tag of the prototype, the title and the author', async ({ page }) => {
  await page.goto('./')
  const head = page.locator('head')

  await expect(page).toHaveTitle('Польский на каждый день')
  await expect(head.locator(meta('viewport'))).toHaveAttribute(
    'content',
    /^width=device-width,\s*initial-scale=1,\s*viewport-fit=cover$/,
  )
  await expect(head.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/Slowo-dnia/manifest.webmanifest',
  )
  const icon = head.locator('link[rel="icon"]')
  await expect(icon).toHaveAttribute('type', 'image/png')
  await expect(icon).toHaveAttribute('sizes', '192x192')
  await expect(icon).toHaveAttribute('href', '/Slowo-dnia/icons/icon-192.png')
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/Slowo-dnia/icons/apple-touch-icon.png',
  )
  await expect(head.locator(meta('apple-mobile-web-app-capable'))).toHaveAttribute('content', 'yes')
  await expect(head.locator(meta('mobile-web-app-capable'))).toHaveAttribute('content', 'yes')
  await expect(head.locator(meta('apple-mobile-web-app-title'))).toHaveAttribute(
    'content',
    'Słowo dnia',
  )
  await expect(head.locator(meta('apple-mobile-web-app-status-bar-style'))).toHaveAttribute(
    'content',
    'black-translucent',
  )
  await expect(head.locator(meta('theme-color'))).toHaveCount(1)
  await expect(head.locator(meta('author'))).toHaveAttribute('content', 'Wlodzimierz Trajgiel')
})

test('the icons in <head> are PNG files of the site', async ({ page, request }) => {
  await page.goto('./')
  const hrefs = await page
    .locator('head > link[rel="icon"], head > link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))
  expect(hrefs).toHaveLength(2)
  for (const href of hrefs) {
    const response = await request.get(href)
    expect(response.status(), href).toBe(200)
    expect(response.headers()['content-type'], href).toBe('image/png')
  }
})

test('the page source carries the copyright comment of the prototype', async ({ request }) => {
  const html = await (await request.get('./')).text()
  expect(html).toContain(
    '<!-- Słowo dnia. © 2026 Wlodzimierz Trajgiel (https://www.linkedin.com/in/trajgiel/). Все права защищены. См. LICENSE. -->',
  )
})
