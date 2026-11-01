import { AdditiveBlending, BackSide, Color, MeshStandardMaterial, ShaderMaterial, type Texture } from 'three'
import type { DepositAppearance } from '@/types/content'

/** Colour of rock glowing hot under the mining beam. */
const HEAT_COLOR = new Color('#ff6a1f')

/**
 * Flat-shaded material for one deposit type. The emissive colour shows only where the geometry's
 * 'glow' weight allows, and each instance adds its own effects through 'instanceFx': x scales the
 * glow (flicker under the beam, fading in on regrowth), y heats the whole deposit while it is mined.
 */
export function createDepositMaterial(appearance: DepositAppearance, reflection: Texture): MeshStandardMaterial {
  const metalness = appearance.metalness ?? 0
  const material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: appearance.roughness ?? 0.9,
    metalness,
    // Metal needs something to reflect, or it renders nearly black.
    envMap: metalness > 0 ? reflection : null,
    envMapIntensity: 1.2,
    emissive: appearance.emissive ?? '#000000',
    emissiveIntensity: appearance.emissiveIntensity ?? 0,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.heatColor = { value: HEAT_COLOR }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float glow;\nattribute vec2 instanceFx;\nvarying float vGlow;\nvarying vec2 vFx;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;\nvFx = instanceFx;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 heatColor;\nvarying float vGlow;\nvarying vec2 vFx;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance = totalEmissiveRadiance * vGlow * vFx.x + heatColor * vFx.y;',
      )
  }
  material.customProgramCacheKey = () => 'mineral-deposit'
  return material
}

/**
 * Soft additive aura around rare deposits, coloured per instance. Drawn from the inside of a
 * sphere so it gathers behind the deposit, and faded out up close where the deposit is in plain view.
 */
export function createHaloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vTint;
      varying float vFade;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        vec4 center = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
          center = instanceMatrix * center;
        #endif
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        vec4 mv = modelViewMatrix * local;
        vNormalView = normalize(normalMatrix * n);
        vViewDir = normalize(-mv.xyz);
        vFade = smoothstep(3.5, 10.0, length((modelViewMatrix * center).xyz));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vTint;
      varying float vFade;
      void main() {
        float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        gl_FragColor = vec4(vTint * pow(facing, 4.0) * vFade, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: BackSide,
  })
}

/** Ore left on the ground: lit normally, plus a gentle glow in its own colour so it stands out. */
export function createOreMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.45, metalness: 0.15 })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.45;',
    )
  }
  material.customProgramCacheKey = () => 'mineral-ore'
  return material
}
