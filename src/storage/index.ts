// storage layer (architecture/react-port/modules.md in the workspace): the prototype's localStorage keys
// and formats (architecture/react-port/storage.md).
import { createRepo, type StorageRepo } from './repo'

// Only the repo is public: key names and raw access stay inside this folder.
export type { StorageLike } from './kv'
export {
  createRepo,
  type CourseProgress,
  type DeckResults,
  type StorageRepo,
  type StoredCourseState,
} from './repo'

/** The app's storage on the page's `localStorage` (with the in-memory fallback). */
export const storage: StorageRepo = createRepo()
