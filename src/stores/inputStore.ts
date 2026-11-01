import { create } from 'zustand'

interface InputStatus {
  /** The mouse is captured for looking around. */
  pointerLocked: boolean
  setPointerLocked: (pointerLocked: boolean) => void
}

/** Low-frequency input status for the UI. Live keys and mouse movement live in input/inputState.ts. */
export const useInputStore = create<InputStatus>((set) => ({
  pointerLocked: false,
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
}))
