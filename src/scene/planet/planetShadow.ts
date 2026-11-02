import { Matrix4, Vector3, type Camera, type Material, type WebGLProgramParametersWithUniforms } from 'three'

/*
 * The Moon's own shadow. The sun's shadow map covers only the area around the player, so beyond
 * the terminator nothing would stop sunlight from reaching slopes that face the sun through the
 * planet. Lit materials pass through `withPlanetShadow`, which dims each directional light (sun and
 * earthshine) wherever the line toward it passes through the Moon, with a soft terminator.
 */

export const planetShadowUniforms = {
  /** The Moon's centre in view space, updated every frame. */
  uPlanetCenter: { value: new Vector3() },
  /** Radius of the occluding sphere, a little below the mean ground so peaks keep the light longest. */
  uPlanetOccluder: { value: 0 },
}

const GLSL = /* glsl */ `
uniform vec3 uPlanetCenter;
uniform float uPlanetOccluder;
// 1 where the light reaches point p, 0 where the Moon is in the way; l points toward the light.
float planetShadow(vec3 p, vec3 l) {
  vec3 toCenter = uPlanetCenter - p;
  float along = dot(toCenter, l);
  if (along <= 0.0) return 1.0;
  float closest = sqrt(max(dot(toCenter, toCenter) - along * along, 0.0));
  return smoothstep(uPlanetOccluder - 25.0, uPlanetOccluder + 5.0, closest);
}
`

/** Adds the Moon's shadow to a lit material. Safe to combine with other shader tweaks. */
export function withPlanetShadow<T extends Material>(material: T): T {
  const previous = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous(shader, renderer)
    shader.uniforms.uPlanetCenter = planetShadowUniforms.uPlanetCenter
    shader.uniforms.uPlanetOccluder = planetShadowUniforms.uPlanetOccluder
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= planetShadow( geometryPosition, directionalLight.direction );',
      )
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${key()}|planet-shadow`
  return material
}

const view = new Matrix4()

/** Call once per frame after the camera has moved, before rendering. */
export function updatePlanetShadow(camera: Camera, occluderRadius: number): void {
  camera.updateMatrixWorld()
  view.copy(camera.matrixWorld).invert()
  planetShadowUniforms.uPlanetCenter.value.set(0, 0, 0).applyMatrix4(view)
  planetShadowUniforms.uPlanetOccluder.value = occluderRadius
}
