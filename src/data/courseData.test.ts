// Course data against the prototype (architecture/react-port/course-data.md in the workspace,
// "Проверка данных"): every word of both courses for both genders, compared with the fixture
// extracted from the prototype by scripts/extract-courses.ts. The only expected differences are
// the three kids translations of content/ui/kids-course-data.md.
import { describe, expect, it } from 'vitest'
import { COURSES, expandWords, type AdultCourseData, type CourseData } from '../domain'
import prototypeRaw from '../test/fixtures/prototype-courses.json?raw'
import adultRaw from './adult.json?raw'
import { isAdultCourseData } from './loadCourse'
import { KIDS_BOY, KIDS_THEMES } from './kidsCourse'

type Form = readonly [string, string, string]
type Entry = readonly [string, string, string, Form?]
type Themes = readonly (readonly [string, readonly Entry[]])[]

interface Prototype {
  kids: Themes
  boy: Record<string, Form>
  boyTheme: Record<string, string>
  adult: Themes
}

interface Word {
  pl: string
  ru: string
  tr: string
  ti: number
  theme: string
}

const prototype = JSON.parse(prototypeRaw) as Prototype
const adult: unknown = JSON.parse(adultRaw)

const KIDS_EDITS = new Map([
  [41, 'Мой любимый цвет…'],
  [240, 'Сто лет! (песенка-поздравление)'],
  [275, 'Раз, два, три, ищу!'],
])

const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined

/** The prototype's `fillDays` (materials/project/APP_SPEC.md → "3.3"), as a reference. */
function expand(
  course: 'kids' | 'adult',
  themes: Themes,
  boy: { words: Record<string, Form>; themes: Record<string, string> },
  girl: boolean,
): Word[] {
  return themes.flatMap(([title, entries], ti) =>
    entries.map((entry) => {
      const kidsBoy = course === 'kids' && !girl
      const m =
        (kidsBoy ? own(boy.words, entry[0]) : course === 'adult' && girl ? entry[3] : undefined) ??
        entry
      const theme = (kidsBoy ? own(boy.themes, title) : undefined) ?? title
      return { pl: m[0], ru: m[1], tr: m[2], ti, theme }
    }),
  )
}

const prototypeBoy = { words: prototype.boy, themes: prototype.boyTheme }
const noBoy = { words: {}, themes: {} }
const words = (themes: Themes) => themes.flatMap(([, entries]) => entries)

describe('course data', () => {
  it('adult.json has the shape the loader accepts', () => {
    expect(isAdultCourseData(adult)).toBe(true)
  })

  it('kids: 500 words in 71 themes; adult: 1000 words in 100 themes of 10', () => {
    expect(KIDS_THEMES).toHaveLength(71)
    expect(words(KIDS_THEMES)).toHaveLength(500)
    const adultThemes = adult as Themes
    expect(adultThemes).toHaveLength(100)
    expect(adultThemes.every(([, entries]) => entries.length === 10)).toBe(true)
  })

  it('the fixture is the full prototype: 500 / 71, 1000 / 100, 18 BOY forms, 48 female forms', () => {
    expect(prototype.kids).toHaveLength(71)
    expect(words(prototype.kids)).toHaveLength(500)
    expect(prototype.adult).toHaveLength(100)
    expect(words(prototype.adult)).toHaveLength(1000)
    expect(Object.keys(prototype.boy)).toHaveLength(18)
    expect(prototype.boyTheme).toEqual({ 'Я готова!': 'Я готов!' })
    expect(words(prototype.adult).filter((entry) => entry[3])).toHaveLength(48)
  })

  describe.each([
    ['girl', true],
    ['boy', false],
  ])('every word for %s', (_gender, girl) => {
    it('kids: pl, ru, tr, number and theme match the prototype except the three translations', () => {
      const expected = expand('kids', prototype.kids, prototypeBoy, girl).map((word, index) => {
        const ru = KIDS_EDITS.get(index)
        return ru === undefined ? word : { ...word, ru }
      })
      const actual = expand('kids', KIDS_THEMES, KIDS_BOY, girl)
      expect(actual).toEqual(expected)
    })

    it('kids: no long dash in translations', () => {
      const dashed = expand('kids', KIDS_THEMES, KIDS_BOY, girl).filter((word) =>
        word.ru.includes('—'),
      )
      expect(dashed).toEqual([])
    })

    it('adult: pl, ru, tr, number and theme match the prototype', () => {
      expect(expand('adult', adult as Themes, noBoy, girl)).toEqual(
        expand('adult', prototype.adult, noBoy, girl),
      )
    })
  })

  describe.each([
    ['kids', { id: 'kids', themes: KIDS_THEMES, boy: KIDS_BOY }],
    ['adult', { id: 'adult', themes: adult as AdultCourseData }],
  ] as const satisfies readonly (readonly [string, CourseData])[])('%s', (id, data) => {
    it.each(['girl', 'boy'] as const)(
      'expandWords for %s gives COURSES.wordCount words',
      (gender) => {
        expect(expandWords(data, gender)).toHaveLength(COURSES[id].wordCount)
      },
    )
  })

  it('kids masculine forms are the prototype BOY and BOY_THEME', () => {
    expect(KIDS_BOY).toEqual({ words: prototype.boy, themes: prototype.boyTheme })
  })
})
