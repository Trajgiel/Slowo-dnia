// End-to-end, SD-17 ("Резервная копия прогресса", "Начать заново"), on the production build in a real
// browser with the real clipboard (analyst/features/react-port/us-7-backup-reset.md;
// us-5-plan-help.md → "План" in the workspace):
// - "Скопировать код" with the clipboard allowed: the code is in the field and in the clipboard, the
//   status counts the learned words; "Сбросить прогресс" twice: the toast, word 1, "План" without marks
//   and only theme 1 open; "Восстановить из кода" twice from the field: the progress keys are back as
//   they were, "План" shows the marks again and opens the theme of the first unlearned word;
// - no clipboard: the code is selected in the field, the status asks to copy it;
// - both courses, against the published prototype in the same browser: the same progress gives the same
//   code string; the prototype's code restores in the new version and the new version's code restores
//   in the prototype to the same done / weak / days.
// Not here (developer, jsdom and node): code format, statuses of broken / other-course / empty codes,
// whitespace, numbers outside the course, the keys written by restore and reset ->
// src/state/appStore.backup.test.ts, src/features/settings/BackupCards.test.tsx; the 5 s of the double
// press -> src/shared/ui/TwoStepButton.test.tsx; leaving the tab while armed -> BackupCards.test.tsx;
// the prototype's own code on generated progress -> tests/backup-sd1.acceptance.test.ts;
// "Отправить…" (no system share in desktop Chromium) -> src/platform/share.test.ts and the owner's
// check on phones.
import { expect, test, type Page } from '@playwright/test'
import common from '../src/i18n/locales/ru/common.json' with { type: 'json' }
import settings from '../src/i18n/locales/ru/settings.json' with { type: 'json' }
import word from '../src/i18n/locales/ru/word.json' with { type: 'json' }
import { startPrototype, type PrototypeSite } from './prototype-site'
import { collectPageErrors, fill, readStorage, seedStorage } from './support'

const KIDS = {
  course: '"kids"',
  done: '[0,1,2,5]',
  weak: '{"1":2,"5":1}',
  days: '["2026-10-24","2026-10-25"]',
  deck_ru: '{"order":[0,1,2,5],"ans":{"0":true}}',
  last_ru: '{"right":3,"wrong":0,"total":3,"date":"2026-10-20"}',
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const codeField = (page: Page) => page.getByRole('textbox', { name: settings.backup.codeLabel })
const backupStatus = (page: Page) => page.locator('.card').getByRole('status')

/** Numbers of the words marked "✓" in "План" and the open themes (from 1). */
const planMarks = (page: Page) =>
  page.locator('.plan').evaluate((plan) => ({
    learned: [...plan.querySelectorAll('.item')]
      .filter((item) => item.querySelector('.ck')?.textContent === '✓')
      .map((item) => item.querySelector('.n')?.textContent),
    open: [...plan.querySelectorAll('details')].flatMap((d, i) => (d.open ? [i + 1] : [])),
    current: plan.querySelector('.item.cur .n')?.textContent,
    currentTheme:
      [...plan.querySelectorAll('details')].findIndex((d) => d.querySelector('.cur')) + 1,
  }))

async function pressTwice(page: Page, label: string, armed: string): Promise<void> {
  await button(page, label).click()
  await expect(button(page, armed)).toBeVisible()
  await button(page, armed).click()
}

const progressKeys = (all: Record<string, string>, p = '') => ({
  done: all[`${p}done`],
  weak: all[`${p}weak`],
  days: all[`${p}days`],
})

test('copy the code, reset, restore it from the field: the progress is back', async ({
  context,
  page,
}) => {
  const errors = collectPageErrors(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12))
  await seedStorage(page, KIDS)
  await page.goto('./#/settings')

  await button(page, settings.backup.copy).click()
  await expect(backupStatus(page)).toHaveText(
    fill(settings.backup.status.copied_few, { course: common.course.kids, count: 4 }),
  )
  const code = await codeField(page).inputValue()
  expect(code).toMatch(/^SD1\.k\./)
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)

  await pressTwice(page, settings.reset.button, settings.reset.confirm)
  await expect(page.getByRole('status').filter({ hasText: settings.reset.toast })).toBeVisible()
  await expect(backupStatus(page)).toHaveText('')
  await expect(codeField(page)).toHaveValue(code)
  expect(progressKeys(await readStorage(page))).toEqual({ done: '[]', weak: '{}', days: '[]' })
  await tab(page, common.tabs.plan).click()
  expect(await planMarks(page)).toEqual({ learned: [], open: [1], current: '1', currentTheme: 1 })
  await tab(page, common.tabs.word).click()
  await expect(page.locator('.card.word')).toContainText(
    fill(word.meta.position, { n: 1, total: 500 }),
  )

  await tab(page, common.tabs.settings).click()
  await expect(codeField(page)).toHaveValue(code)
  await pressTwice(page, settings.backup.restore, settings.backup.restoreConfirm)
  await expect(backupStatus(page)).toHaveText(
    fill(settings.backup.status.restored_few, { course: common.course.kids, count: 4 }),
  )
  const restored = await readStorage(page)
  expect(progressKeys(restored)).toEqual(progressKeys(KIDS))
  expect(restored.last_ru).toBe('null')
  await tab(page, common.tabs.plan).click()
  const marks = await planMarks(page)
  expect(marks).toMatchObject({ learned: ['1', '2', '3', '6'], current: '4' })
  expect(marks.open).toEqual([marks.currentTheme])
  await tab(page, common.tabs.word).click()
  await expect(page.locator('.card.word')).toContainText(
    fill(word.meta.position, { n: 4, total: 500 }),
  )
  expect(errors).toEqual([])
})

test('no clipboard: the code is selected in the field, the status asks to copy it', async ({
  page,
}) => {
  // Plain http and old browsers have no navigator.clipboard.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined })
  })
  await seedStorage(page, KIDS)
  await page.goto('./#/settings')

  await button(page, settings.backup.copy).click()
  await expect(backupStatus(page)).toHaveText(settings.backup.status.selectAndCopy)
  await expect(codeField(page)).toBeFocused()
  const selection = await codeField(page).evaluate((field: HTMLTextAreaElement) => ({
    selected: field.value.slice(field.selectionStart, field.selectionEnd),
    value: field.value,
  }))
  expect(selection.value).toMatch(/^SD1\.k\./)
  expect(selection.selected).toBe(selection.value)
})

// --- The prototype and the new version in the same browser. ---

const COURSES = [
  {
    course: 'kids',
    prefix: '',
    progress: {
      done: '[0,1,2,7,250,499]',
      weak: '{"1":2,"7":1}',
      days: '["2026-10-24","2026-10-25"]',
    },
    restored: fill(settings.backup.status.restored_many, { course: common.course.kids, count: 6 }),
  },
  {
    course: 'adult',
    prefix: 'adult:',
    progress: { done: '[0,5,640,999]', weak: '{"5":3}', days: '["2026-09-30","2026-10-01"]' },
    restored: fill(settings.backup.status.restored_few, { course: common.course.adult, count: 4 }),
  },
] as const

/** Replaces the storage of the page's origin with `items` and reloads at `hash`. */
async function setStorage(page: Page, url: string, items: Record<string, string>): Promise<void> {
  await page.goto(url)
  await page.evaluate((data) => {
    localStorage.clear()
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value)
  }, items)
  await page.reload()
}

const PROTO = {
  settings: 'Настройки',
  copy: 'Скопировать код',
  restore: 'Восстановить из кода',
  restoreConfirm: 'Заменить прогресс этого курса? Нажмите ещё раз',
}

async function openPrototypeSettings(page: Page): Promise<void> {
  await page.getByRole('tab', { name: PROTO.settings }).click()
  await expect(page.locator('#bkCopy')).toBeVisible()
}

let prototype: PrototypeSite | undefined
test.afterEach(async () => {
  await prototype?.close()
  prototype = undefined
})

for (const { course, prefix, progress, restored } of COURSES) {
  test(`${course}: the same code as the prototype; each version restores the other's code`, async ({
    page,
    baseURL,
  }, testInfo) => {
    prototype = await startPrototype(testInfo.outputPath('prototype'))
    const stored = {
      course: JSON.stringify(course),
      ...Object.fromEntries(Object.entries(progress).map(([k, v]) => [prefix + k, v])),
    }
    // Another progress of the same course, to be replaced by the restore.
    const other = { course: JSON.stringify(course), [`${prefix}done`]: '[10]' }
    const reactUrl = new URL('./#/settings', baseURL).href
    const protoUrl = prototype.baseUrl

    // The prototype makes its code.
    await setStorage(page, protoUrl, stored)
    await openPrototypeSettings(page)
    await page.locator('#bkCopy').click()
    await expect(page.locator('#bkCode')).toHaveValue(/^SD1\./)
    const protoCode = await page.locator('#bkCode').inputValue()
    const protoSaved = progressKeys(await readStorage(page), prefix)

    // The new version makes the same code from the same storage.
    await setStorage(page, reactUrl, stored)
    await button(page, settings.backup.copy).click()
    await expect(codeField(page)).toHaveValue(/^SD1\./)
    const reactCode = await codeField(page).inputValue()
    expect(reactCode).toBe(protoCode)
    const reactSaved = progressKeys(await readStorage(page), prefix)
    expect(reactSaved).toEqual(protoSaved)

    // The prototype's code restores in the new version.
    await setStorage(page, reactUrl, other)
    await codeField(page).fill(protoCode)
    await pressTwice(page, settings.backup.restore, settings.backup.restoreConfirm)
    await expect(backupStatus(page)).toHaveText(restored)
    expect(progressKeys(await readStorage(page), prefix)).toEqual(protoSaved)

    // The new version's code restores in the prototype.
    await setStorage(page, protoUrl, other)
    await openPrototypeSettings(page)
    await page.locator('#bkCode').fill(reactCode)
    await page.locator('#bkRestore').click()
    await expect(page.locator('#bkRestore')).toHaveText(PROTO.restoreConfirm)
    await page.locator('#bkRestore').click()
    await expect(page.locator('#bkRestore')).toHaveText(PROTO.restore)
    expect(progressKeys(await readStorage(page), prefix)).toEqual(reactSaved)
  })
}
