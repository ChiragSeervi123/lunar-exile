export interface CreditSection {
  heading: string
  entries: string[]
}

export const CREDITS: CreditSection[] = [
  { heading: 'Created by', entries: ['The Lunar Exile team'] },
  {
    heading: 'Built with',
    entries: [
      'React',
      'Three.js',
      'React Three Fiber & Drei',
      'Rapier physics',
      'Zustand',
      'Tailwind CSS',
      'Lucide icons',
    ],
  },
  { heading: 'Typography', entries: ['Michroma by Vernon Adams', 'Rajdhani by Indian Type Foundry'] },
  { heading: 'Inspired by', entries: ['Every photograph of Earth ever taken from the Moon'] },
]
