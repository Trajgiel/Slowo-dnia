// End-to-end, SD-11 (theme before the first paint), on the production build:
// - US-9 "Theme without a flash": with the light theme saved, no frame of the page is painted
//   dark or in another color while it opens or reloads (slow CPU, slow stylesheet), and the
//   other way round for the dark theme;
// - US-9: the browser bar color (theme-color) matches the theme from the first frame.
// Colors: design/system/README.md → "Colors" (--paper, theme-color) in the workspace.
// Not here: the rule "anything but light is dark" for odd stored values and a broken storage
// -> src/platform/theme.test.ts (developer); applyTheme -> the same file; token values ->
// src/app/styles/tokens.acceptance.test.ts.
import { expect, test, type Page } from '@playwright/test'

interface Frame {
  theme: string | null
  colorScheme: string
  background: string | null
  themeColors: string[]
}

type FrameWindow = Window & { __frames?: Frame[] }

const THEMES = {
  light: { paper: 'rgb(246, 248, 252)', themeColor: '#f6f8fc', colorScheme: 'light' },
  dark: { paper: 'rgb(18, 24, 38)', themeColor: '#121826', colorScheme: 'dark' },
} as const

// Slow CPU (CDP: a slowdown factor, 1 is no throttle).
const CPU_SLOWDOWN = 6
// Frames to observe after the app has rendered, so the switch to React is covered too.
const FRAMES_AFTER_RENDER = 10

/** Saves the theme as the prototype does and records the page state before every painted frame. */
async function recordFramesWithStoredTheme(page: Page, theme: keyof typeof THEMES): Promise<void> {
  await page.addInitScript((stored) => {
    // Runs before the page's own scripts: the `theme` key, JSON as in the prototype.
    localStorage.setItem('theme', JSON.stringify(stored))
    const w = window as FrameWindow
    const frames: Frame[] = []
    w.__frames = frames
    // A requestAnimationFrame callback runs right before each paint: what it reads is what the frame shows.
    const tick = (): void => {
      const html = document.documentElement
      const body = document.body as HTMLElement | null
      frames.push({
        theme: html.dataset.theme ?? null,
        colorScheme: getComputedStyle(html).colorScheme,
        background: body ? getComputedStyle(body).backgroundColor : null,
        themeColors: [
          ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
        ].map((meta) => meta.content),
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, theme)
}

/** Slow network for the stylesheet: it arrives only after the whole page has been parsed. */
async function holdStylesheetUntilParsed(page: Page): Promise<void> {
  await page.route('**/assets/*.css', async (route) => {
    // DOM typings say body is never null; while the page is parsed it is.
    await page.waitForFunction(() => (document.body as HTMLElement | null) !== null)
    await route.continue()
  })
}

async function framesAfterRender(page: Page): Promise<Frame[]> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const seen = await page.evaluate(() => (window as FrameWindow).__frames?.length ?? 0)
  await page.waitForFunction(
    (min) => ((window as FrameWindow).__frames?.length ?? 0) >= min,
    seen + FRAMES_AFTER_RENDER,
  )
  return page.evaluate(() => (window as FrameWindow).__frames ?? [])
}

function expectEveryFrameIn(frames: Frame[], theme: keyof typeof THEMES): void {
  const expected = THEMES[theme]
  expect(frames.length).toBeGreaterThan(FRAMES_AFTER_RENDER)
  frames.forEach((frame, index) => {
    const where = `frame ${String(index)}: ${JSON.stringify(frame)}`
    expect(frame.theme, where).toBe(theme)
    expect(frame.colorScheme, where).toBe(expected.colorScheme)
    expect(frame.themeColors, where).toEqual([expected.themeColor])
    // Before <body> is parsed the browser paints the canvas from the color scheme checked above.
    if (frame.background !== null) expect(frame.background, where).toBe(expected.paper)
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`with the ${theme} theme saved, every frame on open and reload is ${theme} (slow CPU)`, async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
    await recordFramesWithStoredTheme(page, theme)
    await holdStylesheetUntilParsed(page)

    await page.goto('./')
    expectEveryFrameIn(await framesAfterRender(page), theme)

    await page.reload()
    expectEveryFrameIn(await framesAfterRender(page), theme)
  })
}
