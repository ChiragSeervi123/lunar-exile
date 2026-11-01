import { CREDITS } from '@/data/credits'
import { Panel } from '../components/Panel'

interface CreditsPanelProps {
  onClose: () => void
  leaving?: boolean
}

export function CreditsPanel({ onClose, leaving }: CreditsPanelProps) {
  return (
    <Panel eyebrow="LUNAR EXILE" title="CREDITS" onClose={onClose} leaving={leaving}>
      <div className="space-y-10">
        {CREDITS.map((section) => (
          <section key={section.heading}>
            <h3 className="font-ui text-xs font-semibold uppercase tracking-[0.45em] text-lunar-500">
              {section.heading}
            </h3>
            <ul className="mt-4 space-y-2">
              {section.entries.map((entry) => (
                <li key={entry} className="font-ui text-base font-medium tracking-[0.08em] text-lunar-100">
                  {entry}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  )
}
