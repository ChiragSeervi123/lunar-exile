import { SurvivalBars } from './SurvivalBars'

/** In-game overlay. Never captures pointer events so the canvas stays interactive. */
export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 p-4">
      <SurvivalBars />
    </div>
  )
}
