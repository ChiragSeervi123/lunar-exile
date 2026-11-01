import { useEffect, useRef } from 'react'

/**
 * Calls `onEscape` when Escape is pressed. Listens in the capture phase and marks the event as
 * handled, so the innermost open layer (e.g. a panel over the pause menu) closes first.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return
      event.preventDefault()
      handler.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}
