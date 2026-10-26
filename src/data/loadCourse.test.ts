// @vitest-environment node
// Course loader with a fake fetch: success, session memory, concurrent calls, network error,
// 404, wrong shape, retry after an error (architecture/react-port/course-data.md, "Загрузчик курса").
import { describe, expect, it, vi } from 'vitest'
import adultRaw from './adult.json?raw'
import { KIDS_BOY, KIDS_THEMES } from './kidsCourse'
import {
  CourseLoadError,
  createCourseLoader,
  isAdultCourseData,
  retryNeedsReload,
} from './loadCourse'

const URL = '/Slowo-dnia/assets/adult-abc123.json'
const adult: unknown = JSON.parse(adultRaw)

const ok = () => new Response(adultRaw, { status: 200 })

function setup(...responses: (() => Response | Promise<Response>)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const respond of responses) fetch.mockImplementationOnce(() => Promise.resolve(respond()))
  return { fetch, load: createCourseLoader({ adultUrl: URL, fetch }) }
}

async function failure(promise: Promise<unknown>): Promise<CourseLoadError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(CourseLoadError)
  return error as CourseLoadError
}

describe('createCourseLoader', () => {
  it('kids: the bundled course, no request', async () => {
    const { fetch, load } = setup()
    await expect(load('kids')).resolves.toEqual({ id: 'kids', themes: KIDS_THEMES, boy: KIDS_BOY })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('adult: fetches the file and returns its themes', async () => {
    const { fetch, load } = setup(ok)
    await expect(load('adult')).resolves.toEqual({ id: 'adult', themes: adult })
    expect(fetch).toHaveBeenCalledExactlyOnceWith(URL)
  })

  it('adult: kept in memory, a later call makes no request', async () => {
    const { fetch, load } = setup(ok)
    const first = await load('adult')
    expect(await load('adult')).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('two concurrent loads share one request', async () => {
    const { fetch, load } = setup(ok)
    const [a, b] = await Promise.all([load('adult'), load('adult')])
    expect(a).toBe(b)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('no network → kind "network"', async () => {
    const { load, fetch } = setup()
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect((await failure(load('adult'))).kind).toBe('network')
  })

  it('body cut off while reading → kind "network"', async () => {
    const response = ok()
    vi.spyOn(response, 'text').mockRejectedValue(new TypeError('network error'))
    const { load } = setup(() => response)
    expect((await failure(load('adult'))).kind).toBe('network')
  })

  it('server error → kind "network" (a retry may help)', async () => {
    const { load } = setup(() => new Response('', { status: 503 }))
    expect((await failure(load('adult'))).kind).toBe('network')
  })

  it('404 → kind "not-found", distinct from a network error', async () => {
    const { load } = setup(() => new Response('Not Found', { status: 404 }))
    expect((await failure(load('adult'))).kind).toBe('not-found')
  })

  it.each([
    ['not JSON', '<!doctype html>'],
    ['not an array', '{}'],
    [
      '999 words',
      JSON.stringify(
        (adult as unknown[][]).map((t, i) => (i === 0 ? [t[0], (t[1] as unknown[]).slice(1)] : t)),
      ),
    ],
  ])('wrong shape (%s) → kind "invalid"', async (_case, body) => {
    const { load } = setup(() => new Response(body, { status: 200 }))
    expect((await failure(load('adult'))).kind).toBe('invalid')
  })

  it('after an error a retry makes a new request', async () => {
    const { fetch, load } = setup()
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetch.mockResolvedValueOnce(ok())
    await failure(load('adult'))
    await expect(load('adult')).resolves.toMatchObject({ id: 'adult' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('concurrent calls during a failing load share its error, the next call retries', async () => {
    const { fetch, load } = setup(() => new Response('', { status: 404 }), ok)
    const [a, b] = await Promise.allSettled([load('adult'), load('adult')])
    expect([a.status, b.status]).toEqual(['rejected', 'rejected'])
    expect(fetch).toHaveBeenCalledTimes(1)
    await expect(load('adult')).resolves.toMatchObject({ id: 'adult' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('isAdultCourseData', () => {
  const form = ['pl', 'ru', 'tr']
  const theme = (entries: unknown[]) => ['Тема', entries]
  const course = (entry: unknown) => [theme([entry, ...Array<unknown>(999).fill(form)])]

  it.each([
    ['3 strings', form, true],
    ['4th element is a form', [...form, form], true],
    ['2 items', ['pl', 'ru'], false],
    ['not a string', ['pl', 'ru', 1], false],
    ['4th element is not a form', [...form, 'x'], false],
    ['4th element of 2 items', [...form, ['pl', 'ru']], false],
    ['5 items', [...form, form, form], false],
  ])('entry with %s → %s', (_case, entry, expected) => {
    expect(isAdultCourseData(course(entry))).toBe(expected)
  })

  it.each([
    ['not an array', {}],
    ['theme without entries', [['Тема']]],
    ['theme title not a string', [[1, Array<unknown>(1000).fill(form)]]],
    ['1001 words', [theme(Array<unknown>(1001).fill(form))]],
  ])('%s → false', (_case, value) => {
    expect(isAdultCourseData(value)).toBe(false)
  })
})

describe('retryNeedsReload', () => {
  it.each([
    ['network', false],
    ['not-found', true],
    ['invalid', true],
  ] as const)('%s → %s', (kind, expected) => {
    expect(retryNeedsReload(kind)).toBe(expected)
  })
})
