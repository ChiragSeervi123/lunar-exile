import type { KeyboardEvent } from 'react'

/** Arrow keys move focus between the enabled buttons of a menu. Attach as the container's onKeyDown. */
export function moveMenuFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (items.length === 0) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  items[(current + step + items.length) % items.length].focus()
}
