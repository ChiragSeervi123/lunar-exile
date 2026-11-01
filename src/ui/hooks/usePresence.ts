import { useEffect, useState } from 'react'

/**
 * Keeps the last non-null `value` for `exitMs` after it is cleared, so the UI can play an exit
 * animation before unmounting. `leaving` is true during that window.
 */
export function usePresence<T>(value: T | null, exitMs: number): { value: T | null; leaving: boolean } {
  const [retained, setRetained] = useState<T | null>(value)
  if (value !== null && value !== retained) setRetained(value)

  useEffect(() => {
    if (value !== null) return
    const timer = window.setTimeout(() => setRetained(null), exitMs)
    return () => window.clearTimeout(timer)
  }, [value, exitMs])

  return value !== null ? { value, leaving: false } : { value: retained, leaving: retained !== null }
}
