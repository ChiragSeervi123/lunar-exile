import type { Material, WebGLProgramParametersWithUniforms } from 'three'

/*
 * Keeps the sky out of the caves. The sun's shadow map covers a wide area at low resolution, so on
 * its own it lets sunlight through meters of rock in stripes. Cave rock carries a per-vertex `sky`
 * attribute (1 at the mouth, 0 a few meters down; see caveMesh.ts) that scales every directional
 * light (sun, earthshine). Point and spot lights, like the helmet lamp, are untouched.
 */

/** Adds the cave rock's sky fade to a lit material. Safe to combine with other shader tweaks. */
export function withCaveSky<T extends Material>(material: T): T {
  const previous = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous(shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sky;\nvarying float vSky;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSky = sky;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSky;')
      .replace(
        'getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSky;',
      )
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${key()}|cave-sky`
  return material
}
