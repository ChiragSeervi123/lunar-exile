import { useGameStore } from '@/stores/gameStore'

export function MainMenu() {
  const setPhase = useGameStore((s) => s.setPhase)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-black text-slate-200">
      <h1 className="text-4xl font-semibold tracking-[0.4em]">LUNAR EXILE</h1>
      <button
        type="button"
        onClick={() => setPhase('playing')}
        className="rounded bg-slate-700 px-6 py-2 hover:bg-slate-600"
      >
        Start
      </button>
    </div>
  )
}
