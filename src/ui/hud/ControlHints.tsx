import { actionLabel, KEYBINDINGS, keyLabel } from '@/config/input'
import { useGameStore } from '@/stores/gameStore'
import { useInputStore } from '@/stores/inputStore'
import { usePlayerStore } from '@/stores/playerStore'

function Key({ children }: { children: string }) {
  return (
    <kbd className="border border-lunar-700 px-1.5 py-0.5 font-ui text-[10px] font-semibold tracking-[0.15em] text-lunar-200">
      {children}
    </kbd>
  )
}

/** Which camera is active, with the key that switches it. */
export function CameraModeIndicator() {
  const mode = usePlayerStore((s) => s.cameraMode)
  return (
    <div className="absolute right-6 top-16 flex items-center gap-3 text-[11px] font-semibold tracking-[0.3em] text-lunar-400 sm:bottom-10 sm:right-10 sm:top-auto">
      <Key>{actionLabel('toggleCamera')}</Key>
      <span key={mode} className="animate-fade-in text-lunar-200" style={{ animationDuration: '400ms' }}>
        {mode === 'first-person' ? 'FIRST PERSON' : 'THIRD PERSON'}
      </span>
    </div>
  )
}

const MOVE_KEYS = [KEYBINDINGS.moveForward[0], KEYBINDINGS.moveLeft[0], KEYBINDINGS.moveBack[0], KEYBINDINGS.moveRight[0]]

/** Keyboard reminder shown for the first seconds of play, above the survival bars; hidden on touch-sized screens. */
export function ControlsHint() {
  const rows: [string, string][][] = [
    [
      [MOVE_KEYS.map(keyLabel).join(''), 'MOVE'],
      [actionLabel('sprint'), 'SPRINT'],
      [actionLabel('jump'), 'JUMP'],
      [actionLabel('toggleCamera'), 'CAMERA'],
      ['MOUSE', 'LOOK'],
    ],
    [
      [actionLabel('mine'), 'MINE'],
      [actionLabel('interact'), 'COLLECT'],
      [actionLabel('inventory'), 'INVENTORY'],
    ],
  ]
  return (
    <div className="absolute inset-x-0 bottom-48 hidden animate-hints flex-col items-center gap-3 px-6 sm:flex">
      {rows.map((items, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold tracking-[0.3em] text-lunar-400 [text-shadow:0_0_10px_rgb(0_0_0/0.6)]"
        >
          {items.map(([key, label]) => (
            <span key={label} className="flex items-center gap-2">
              <Key>{key}</Key>
              {label}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Shown while playing without the mouse captured, e.g. when the browser refused to lock it. */
export function LookHint() {
  const playing = useGameStore((s) => s.phase === 'playing')
  const locked = useInputStore((s) => s.pointerLocked)
  if (!playing || locked) return null
  return (
    <p className="absolute inset-x-0 bottom-24 animate-fade-in text-center text-[11px] font-semibold tracking-[0.35em] text-lunar-300 [text-shadow:0_0_12px_rgb(0_0_0/0.8)]">
      CLICK TO LOOK AROUND · OR DRAG
    </p>
  )
}
