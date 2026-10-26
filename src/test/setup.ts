import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup()
})

// jsdom does not implement scrolling and logs "Not implemented" on every call.
if (typeof window !== 'undefined') window.scrollTo = vi.fn()
