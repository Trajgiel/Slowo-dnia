// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { COURSES, coursePrefix, expandWords, isCourseId, isGender, type CourseData } from './course'

const kids: CourseData = {
  id: 'kids',
  themes: [
    [
      'Привет',
      [
        ['Cześć', 'Привет', 'чэщьчь'],
        ['Skończyłam!', 'Я закончила!', 'скончы́уам'],
      ],
    ],
    [
      'Я готова!',
      [
        ['Jestem nowa', 'Я новенькая', 'е́стэм но́ва'],
        ['constructor', 'не из словаря', 'x'],
      ],
    ],
  ],
  boy: {
    words: {
      'Skończyłam!': ['Skończyłem!', 'Я закончил!', 'скончы́уэм'],
      'Jestem nowa': ['Jestem nowy', 'Я новенький', 'е́стэм но́вы'],
    },
    themes: { 'Я готова!': 'Я готов!' },
  },
}

const adult: CourseData = {
  id: 'adult',
  themes: [
    [
      'Работа',
      [
        ['praca', 'работа', 'пра́ца'],
        ['Jestem gotowy', 'Я готов', 'е́стэм гото́вы', ['Jestem gotowa', 'Я готова', 'е́стэм гото́ва']],
      ],
    ],
    ['Дом', [['dom', 'дом', 'дом']]],
  ],
}

describe('course metadata', () => {
  it('prefixes and word counts as in the prototype', () => {
    expect(coursePrefix('kids')).toBe('')
    expect(coursePrefix('adult')).toBe('adult:')
    expect(COURSES.kids.wordCount).toBe(500)
    expect(COURSES.adult.wordCount).toBe(1000)
  })

  it.each([
    ['kids', true],
    ['adult', true],
    ['Kids', false],
    [null, false],
    ['', false],
  ])('isCourseId(%j) → %s', (v, ok) => {
    expect(isCourseId(v)).toBe(ok)
  })

  it.each([
    ['girl', true],
    ['boy', true],
    ['man', false],
    [undefined, false],
  ])('isGender(%j) → %s', (v, ok) => {
    expect(isGender(v)).toBe(ok)
  })
})

describe('expandWords', () => {
  it('kids, girl: base forms, flat indices across themes', () => {
    expect(expandWords(kids, 'girl')).toEqual([
      { pl: 'Cześć', ru: 'Привет', tr: 'чэщьчь', ti: 0, theme: 'Привет' },
      { pl: 'Skończyłam!', ru: 'Я закончила!', tr: 'скончы́уам', ti: 0, theme: 'Привет' },
      { pl: 'Jestem nowa', ru: 'Я новенькая', tr: 'е́стэм но́ва', ti: 1, theme: 'Я готова!' },
      { pl: 'constructor', ru: 'не из словаря', tr: 'x', ti: 1, theme: 'Я готова!' },
    ])
  })

  it('kids, boy: masculine words and theme title from the boy forms; others unchanged', () => {
    expect(expandWords(kids, 'boy')).toEqual([
      { pl: 'Cześć', ru: 'Привет', tr: 'чэщьчь', ti: 0, theme: 'Привет' },
      { pl: 'Skończyłem!', ru: 'Я закончил!', tr: 'скончы́уэм', ti: 0, theme: 'Привет' },
      { pl: 'Jestem nowy', ru: 'Я новенький', tr: 'е́стэм но́вы', ti: 1, theme: 'Я готов!' },
      { pl: 'constructor', ru: 'не из словаря', tr: 'x', ti: 1, theme: 'Я готов!' },
    ])
  })

  it('kids, boy: an empty boy theme title falls back to the original one (prototype `||`)', () => {
    const course: CourseData = { ...kids, boy: { ...kids.boy, themes: { 'Я готова!': '' } } }
    expect(expandWords(course, 'boy').map((w) => w.theme)).toEqual([
      'Привет',
      'Привет',
      'Я готова!',
      'Я готова!',
    ])
  })

  it('adult, boy (man): base forms', () => {
    expect(expandWords(adult, 'boy').map((w) => [w.pl, w.ru, w.tr, w.ti, w.theme])).toEqual([
      ['praca', 'работа', 'пра́ца', 0, 'Работа'],
      ['Jestem gotowy', 'Я готов', 'е́стэм гото́вы', 0, 'Работа'],
      ['dom', 'дом', 'дом', 1, 'Дом'],
    ])
  })

  it('adult, girl (woman): the 4th element where present; theme titles unchanged', () => {
    expect(expandWords(adult, 'girl').map((w) => [w.pl, w.ru, w.tr, w.ti, w.theme])).toEqual([
      ['praca', 'работа', 'пра́ца', 0, 'Работа'],
      ['Jestem gotowa', 'Я готова', 'е́стэм гото́ва', 0, 'Работа'],
      ['dom', 'дом', 'дом', 1, 'Дом'],
    ])
  })

  it('gender changes only texts: same count and themes per index', () => {
    for (const course of [kids, adult]) {
      const girl = expandWords(course, 'girl')
      const boy = expandWords(course, 'boy')
      expect(boy).toHaveLength(girl.length)
      expect(boy.map((w) => w.ti)).toEqual(girl.map((w) => w.ti))
    }
  })
})
