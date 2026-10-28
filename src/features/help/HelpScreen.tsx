// "Как" tab (analyst/features/react-port/us-5-plan-help.md → "Как"; materials/project/APP_SPEC.md → "6.4. Как"):
// one card with "Каждый день" and "Повторение" of the chosen course, the common pronunciation table,
// "Полезно знать" (the gender line by course and gender, then the course's tips) and the voice setup.
// Texts follow the course and gender in the store at once.
import { Fragment } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { CourseId, Gender } from '../../domain'
import { useCourse, useGender } from '../../state'
import './HelpScreen.css'

type HelpT = ReturnType<typeof useTranslation<'help'>>['t']

/** "Каждый день" and "Повторение" of the course: keys are written out, so the dictionary check sees them. */
function courseLists(t: HelpT, course: CourseId): { daily: string[]; review: string[] } {
  return course === 'adult'
    ? {
        daily: [t('daily.adult.1'), t('daily.adult.2'), t('daily.adult.3'), t('daily.adult.4')],
        review: [t('review.adult.1'), t('review.adult.2'), t('review.adult.3')],
      }
    : {
        daily: [t('daily.kids.1'), t('daily.kids.2'), t('daily.kids.3'), t('daily.kids.4')],
        review: [t('review.kids.1'), t('review.kids.2'), t('review.kids.3')],
      }
}

/** The gender line, a whole sentence for each course and gender. */
function genderNote(t: HelpT, course: CourseId, gender: Gender): string {
  if (course === 'adult')
    return gender === 'boy' ? t('tips.gender.adult.boy') : t('tips.gender.adult.girl')
  return gender === 'boy' ? t('tips.gender.kids.boy') : t('tips.gender.kids.girl')
}

function courseTips(t: HelpT, course: CourseId): string[] {
  return course === 'adult'
    ? [t('tips.adult.address'), t('tips.adult.size')]
    : [t('tips.kids.teacher'), t('tips.kids.size')]
}

export function HelpScreen() {
  const { t } = useTranslation('help')
  // The tabs are shown only with a course open; kids is the prototype's default before that.
  const course = useCourse() ?? 'kids'
  const gender = useGender()
  const { daily, review } = courseLists(t, course)

  const sounds = [
    [t('sounds.l.letter'), t('sounds.l.text')],
    [t('sounds.nasal.letter'), t('sounds.nasal.text')],
    [t('sounds.hard.letter'), t('sounds.hard.text')],
    [t('sounds.soft.letter'), t('sounds.soft.text')],
    [t('sounds.zh.letter'), t('sounds.zh.text')],
    [t('sounds.y.letter'), t('sounds.y.text')],
    [t('sounds.ch.letter'), t('sounds.ch.text')],
  ] as const

  return (
    <section className="view">
      <h2>{t('title')}</h2>
      <div className="card help">
        <div>
          <h3>{t('daily.title')}</h3>
          <ul>
            {daily.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t('review.title')}</h3>
          <ul>
            {review.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t('pronunciation.title')}</h3>
          <p className="msg">{t('pronunciation.text')}</p>
          <div className="sounds">
            {sounds.map(([letter, text]) => (
              <Fragment key={letter}>
                <b>{letter}</b>
                <span>{text}</span>
              </Fragment>
            ))}
          </div>
        </div>
        <div>
          <h3>{t('tips.title')}</h3>
          <ul>
            <li>{genderNote(t, course, gender)}</li>
            {courseTips(t, course).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t('noVoice.title')}</h3>
          <ul>
            <li>
              <Trans t={t} i18nKey="noVoice.ios" components={{ b: <b /> }} />
            </li>
            <li>
              <Trans t={t} i18nKey="noVoice.android" components={{ b: <b /> }} />
            </li>
            <li>{t('noVoice.restart')}</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
