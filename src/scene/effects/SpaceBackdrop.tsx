import { Stars } from '@react-three/drei'

export function SpaceBackdrop() {
  return (
    <>
      <color attach="background" args={['#020308']} />
      <Stars radius={300} depth={60} count={4000} factor={4} fade />
    </>
  )
}
