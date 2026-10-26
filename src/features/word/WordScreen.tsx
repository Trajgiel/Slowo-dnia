// "Слово" tab. Placeholder of the app shell (SD-12): only the header; the word screen task fills it in.
import { CourseHeader } from './CourseHeader'

export function WordScreen() {
  return (
    <section className="view">
      <CourseHeader />
    </section>
  )
}
