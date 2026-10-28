import adult from '../data/adult.json'
import { createCourseLoader, type LoadCourse } from '../data'

/** Loader with the real data of both courses (themes of 10 words, the real texts), no network. */
export const realCourses: LoadCourse = createCourseLoader({
  adultUrl: 'adult.json',
  fetch: () => Promise.resolve(new Response(JSON.stringify(adult))),
})
