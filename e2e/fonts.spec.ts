// End-to-end, SD-11 (own fonts), on the production build:
// - US-9: fonts come only from the site itself (/Slowo-dnia/fonts/), no request leaves its origin;
// - US-9: Cyrillic, Latin and Polish letters (ł, ę, ą, ś, ć, ż, ź, ń, ó) are drawn with Nunito in
//   text and with Caveat in headings, every glyph by the web font (no system fallback);
// - US-9: while a font is loading, the text is already visible in the fallback font.
// The font actually used for each glyph is read from the browser (CDP CSS.getPlatformFontsForNode).
// Not here: no other-domain URLs in the built files -> tests/skeleton-build.acceptance.test.ts
// (SD-6); font files equal to the prototype's -> checked once by qa in SD-6.
import { expect, test, type CDPSession, type Page } from '@playwright/test'

const SAMPLES = {
  cyrillic: 'Привет, как дела? Ёжик и щука',
  latin: 'Dzien dobry, quick brown fox',
  polish: 'łęąśćżźńó ŁĘĄŚĆŻŹŃÓ',
} as const

type Sample = keyof typeof SAMPLES

// Body text uses the body font, headings the handwritten one (as the screens will).
const FAMILIES = [
  { family: 'Nunito', tag: 'p' },
  { family: 'Caveat', tag: 'h2' },
] as const

/** The family inside the font file; a variable font names its default instance ("Nunito ExtraLight"). */
function familyName(family: string): RegExp {
  return new RegExp(`^${family}\\b`)
}

interface PlatformFont {
  familyName: string
  isCustomFont: boolean
  glyphCount: number
}

/** Adds the sample texts to the page, outside the React root. */
async function addSamples(page: Page): Promise<void> {
  await page.evaluate(
    ({ samples, families }) => {
      const box = document.createElement('section')
      box.id = 'font-samples'
      for (const { family, tag } of families) {
        for (const [name, text] of Object.entries(samples)) {
          const el = document.createElement(tag)
          el.id = `${family}-${name}`
          el.textContent = text
          box.append(el)
        }
      }
      document.body.append(box)
    },
    { samples: SAMPLES, families: FAMILIES },
  )
}

async function platformFonts(cdp: CDPSession, selector: string): Promise<PlatformFont[]> {
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  return fonts
}

async function openWithCdp(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  return cdp
}

test('fonts load only from the site, and every request stays on its origin', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? '').origin
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await addSamples(page)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))

  expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([])
  const fontFiles = requests
    .filter((url) => url.endsWith('.woff2'))
    .map((url) => new URL(url).pathname)
    .sort()
  expect(fontFiles).toEqual([
    '/Slowo-dnia/fonts/caveat-cyrillic.woff2',
    '/Slowo-dnia/fonts/caveat-latin-ext.woff2',
    '/Slowo-dnia/fonts/caveat-latin.woff2',
    '/Slowo-dnia/fonts/nunito-cyrillic.woff2',
    '/Slowo-dnia/fonts/nunito-latin-ext.woff2',
    '/Slowo-dnia/fonts/nunito-latin.woff2',
  ])
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family),
  )
  expect(loaded).toHaveLength(6)
})

for (const { family } of FAMILIES) {
  for (const sample of Object.keys(SAMPLES) as Sample[]) {
    test(`${sample} letters are drawn with ${family}`, async ({ page }) => {
      const cdp = await openWithCdp(page)
      await page.goto('./')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await addSamples(page)
      await page.evaluate(() => document.fonts.ready.then(() => undefined))

      const fonts = await platformFonts(cdp, `#${family}-${sample}`)
      // One web font for every glyph: no letter falls back to a system font.
      expect(fonts).toEqual([
        expect.objectContaining({
          familyName: expect.stringMatching(familyName(family)),
          isCustomFont: true,
        }),
      ])
      // The samples are precomposed letters of the Basic Multilingual Plane: one glyph per UTF-16 unit.
      expect(fonts[0]?.glyphCount).toBe(SAMPLES[sample].length)
    })
  }
}

test('while the fonts are loading, the text is visible in the fallback font', async ({ page }) => {
  let release = (): void => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  // Slow network for the fonts: they arrive only when the test lets them.
  await page.route('**/fonts/*.woff2', async (route) => {
    await released
    await route.continue()
  })
  const cdp = await openWithCdp(page)

  try {
    // A pending font delays the load event, so the test waits only for the parsed page.
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await addSamples(page)
    const pending = await page.evaluate(() =>
      [...document.fonts].some((face) => face.status === 'loading'),
    )
    expect(pending).toBe(true)

    const selector = '#Nunito-cyrillic'
    const fallback = await platformFonts(cdp, selector)
    expect(fallback.every((font) => !font.isCustomFont)).toBe(true)

    // Visible text: the element looks different from the same element with transparent text.
    // CDP screenshots, since Playwright's own screenshot waits for the fonts.
    const box = await page.locator(selector).boundingBox()
    if (!box) throw new Error(`${selector} has no box`)
    const clip = { ...box, scale: 1 }
    const shot = async (): Promise<string> =>
      (await cdp.send('Page.captureScreenshot', { format: 'png', clip })).data
    const withText = await shot()
    await page.locator(selector).evaluate((el) => {
      el.style.color = 'transparent'
    })
    const withoutText = await shot()
    expect(withText).not.toBe(withoutText)
  } finally {
    release()
  }

  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  expect(await platformFonts(cdp, '#Nunito-cyrillic')).toEqual([
    expect.objectContaining({
      familyName: expect.stringMatching(familyName('Nunito')),
      isCustomFont: true,
    }),
  ])
})
