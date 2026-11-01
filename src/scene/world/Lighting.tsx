export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[50, 80, 30]} intensity={2.5} />
    </>
  )
}
