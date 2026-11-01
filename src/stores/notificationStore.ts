import { create } from 'zustand'
import { MINING } from '@/config/mining'

/** 'gain': items went into the backpack. 'full': there was no room for them. */
export type NoticeKind = 'gain' | 'full'

export interface Notice {
  id: number
  kind: NoticeKind
  itemId: string
  quantity: number
  /** When the notice last changed (performance.now() ms); it stays up for a while after. */
  updatedAt: number
}

interface NotificationState {
  notices: Notice[]
  /** Shows a notice, or adds to a matching one that is still fresh. */
  notify: (kind: NoticeKind, itemId: string, quantity: number, now?: number) => void
  dismiss: (id: number) => void
  clear: () => void
}

let nextId = 1

export const useNotificationStore = create<NotificationState>((set) => ({
  notices: [],
  notify: (kind, itemId, quantity, now = performance.now()) =>
    set(({ notices }) => {
      const { max, mergeWindow } = MINING.notifications
      const match = notices.find(
        (n) => n.kind === kind && n.itemId === itemId && now - n.updatedAt < mergeWindow,
      )
      if (match) {
        const merged = { ...match, quantity: kind === 'gain' ? match.quantity + quantity : quantity, updatedAt: now }
        return { notices: notices.map((n) => (n === match ? merged : n)) }
      }
      // Oldest notices make way for new ones.
      return { notices: [...notices, { id: nextId++, kind, itemId, quantity, updatedAt: now }].slice(-max) }
    }),
  dismiss: (id) => set(({ notices }) => ({ notices: notices.filter((n) => n.id !== id) })),
  clear: () => set({ notices: [] }),
}))
