// Hooks the components use; they select a part of the store and do not know its shape.
import { useContext } from 'react'
import { useStore } from 'zustand'
import type { CourseId } from '../domain'
import type { AppActions, AppState, CourseLoad, Gate, Toast } from './appStore'
import { AppStoreContext } from './context'

function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider')
  return useStore(store, selector)
}

/** What to show instead of the tabs while the course is not ready. */
export const useGate = (): Gate => useAppStore((s) => s.gate)
/** The open course (`null` until a course is ready). */
export const useCourse = (): CourseId | null => useAppStore((s) => s.course)
export const useCourseLoad = (): CourseLoad => useAppStore((s) => s.courseLoad)
export const useToast = (): Toast | null => useAppStore((s) => s.toast)
/** Store actions; the object never changes. */
export const useAppActions = (): AppActions => useAppStore((s) => s.actions)
