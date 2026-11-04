import { MeshDepthMaterial, type Material, type WebGLProgramParametersWithUniforms } from 'three'

/*
 * Terrain is flat shaded (each triangle lit by its own facet), which would light a chunk's skirts as
 * the vertical walls they are: dark lines wherever a skirt shows between chunks of different
 * detail. Vertices flagged by the `skirt` attribute are lit with their stored normal instead, the
 * normal of the ground edge they hang from, so the strip reads as part of that ground.
 */

/** Lights skirt triangles as the ground they hang from. Safe to combine with other shader tweaks. */
export function withSkirtShading<T extends Material>(material: T): T {
  const previous = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous(shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float skirt;\nvarying float vSkirt;\nvarying vec3 vSkirtNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSkirt = skirt;\n\tvSkirtNormal = normalMatrix * normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSkirt;\nvarying vec3 vSkirtNormal;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tif ( vSkirt > 0.5 ) normal = normalize( vSkirtNormal );')
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${key()}|skirt-shading`
  return material
}

/**
 * The terrain's shadow-pass material, without the skirts: they hang below the ground, and as
 * casters they would print a dotted shadow line along every chunk border under a low sun. Skirt
 * triangles are made of skirt vertices only, so moving those out of the clip volume drops them
 * whole, without a discard that would slow down the rest of the pass.
 */
export function createSkirtlessDepthMaterial(): MeshDepthMaterial {
  const material = new MeshDepthMaterial()
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float skirt;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tif ( skirt > 0.5 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );')
  }
  material.customProgramCacheKey = () => 'skirtless-depth'
  return material
}
