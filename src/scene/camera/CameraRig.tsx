import { PerspectiveCamera } from '@react-three/drei'
import { CAMERA } from '@/config/camera'
import { usePlayerStore } from '@/stores/playerStore'

/** Owns camera mode behaviour. Currently only applies FOV; follow logic comes with the player. */
export function CameraRig() {
  const mode = usePlayerStore((s) => s.cameraMode)
  return <PerspectiveCamera makeDefault fov={CAMERA.fov[mode]} position={[0, CAMERA.eyeHeight, 5]} />
}
