// GLSL for sky objects. All end with three's tone-mapping and colour-space chunks so they match the scene.

/*
 * 3D simplex noise by Ian McEwan and Stefan Gustavson (webgl-noise).
 * Copyright (C) 2011 Ashima Arts. Distributed under the MIT License.
 */
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amplitude * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return sum;
}

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
`

const WORLD_VARYINGS_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

/** Earth: procedural oceans, continents, ice caps, drifting clouds, city lights and atmosphere rim. */
export const earthShader = {
  vertexShader: WORLD_VARYINGS_VERTEX,
  fragmentShader: /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vWorld;
${SIMPLEX_3D}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);
  vec3 p = rotateY(normalize(vLocal), uTime * 0.004);

  float continents = fbm(p * 1.7 + vec3(3.0, 1.0, 7.0));
  float land = smoothstep(0.04, 0.09, continents);
  float shelf = (1.0 - land) * smoothstep(-0.08, 0.06, continents);
  vec3 ocean = mix(vec3(0.010, 0.040, 0.130), vec3(0.030, 0.150, 0.300), shelf);

  float latitude = abs(p.y);
  float dryness = smoothstep(-0.05, 0.35, fbm(p * 3.1 + 11.0)) * (1.0 - smoothstep(0.25, 0.55, latitude));
  vec3 terrain = mix(vec3(0.060, 0.130, 0.050), vec3(0.200, 0.170, 0.120), smoothstep(0.15, 0.45, continents));
  terrain = mix(terrain, vec3(0.420, 0.320, 0.190), dryness);
  vec3 surface = mix(ocean, terrain, land);
  float ice = smoothstep(0.80, 0.88, latitude + 0.05 * fbm(p * 5.0));
  surface = mix(surface, vec3(0.850, 0.900, 0.950), ice);

  vec3 c = rotateY(normalize(vLocal), uTime * 0.0065);
  float clouds = smoothstep(0.05, 0.42, fbm(c * 2.4 + 0.6 * fbm(c * 1.3 + 20.0)) + 0.12 * (1.0 - latitude));
  vec3 albedo = mix(surface, vec3(0.950), clouds * 0.9);

  float ndl = dot(N, L);
  float day = smoothstep(-0.08, 0.2, ndl);
  vec3 color = albedo * (max(ndl, 0.0) * 1.9 + 0.004);
  color += vec3(0.30, 0.12, 0.05) * 0.06 * exp(-pow(ndl * 12.0, 2.0)) * clouds;

  vec3 H = normalize(L + V);
  float glint = pow(max(dot(N, H), 0.0), 90.0) * (1.0 - land) * (1.0 - clouds) * day;
  color += vec3(1.0, 0.95, 0.85) * glint * 0.9;

  // City lights: sparse, clustered along coasts and settled regions, only deep in the night side.
  float night = 1.0 - smoothstep(-0.2, -0.02, ndl);
  float settled = smoothstep(0.1, 0.6, snoise(p * 6.0 + 4.0)) * (1.0 - smoothstep(0.09, 0.3, continents));
  float cities = smoothstep(0.72, 0.95, snoise(p * 55.0)) * settled * land * (1.0 - ice) * (1.0 - clouds);
  color += vec3(1.0, 0.7, 0.35) * cities * night * 0.35;

  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  color += vec3(0.25, 0.52, 1.0) * rim * (0.08 + 0.92 * day) * 1.1;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
}

/** Additive glow around a sphere, brightest at the limb and on the sunlit side. Render on back faces. */
export const atmosphereShader = {
  vertexShader: WORLD_VARYINGS_VERTEX,
  fragmentShader: /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uColor;
uniform float uLimb;
uniform float uFalloff;
uniform float uIntensity;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float facing = abs(dot(N, V));
  float glow = pow(clamp(facing / uLimb, 0.0, 1.0), uFalloff);
  vec3 limbNormal = normalize(N - dot(N, V) * V);
  float lit = 0.15 + 0.85 * smoothstep(-0.45, 0.6, dot(limbNormal, normalize(uSunDir)));
  gl_FragColor = vec4(uColor * glow * lit * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
}

/** Sun disc with a soft glare, drawn on a camera-facing quad. */
export const sunShader = {
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.12, 0.09, d);
  float glare = exp(-d * 9.0) * 0.9 + exp(-d * 3.2) * 0.16;
  float edge = smoothstep(1.0, 0.75, d);
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * (core * 5.0 + glare * 1.6) * edge, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
}

/** Round, soft stars of varying size and colour. */
export const starShader = {
  vertexShader: /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`,
  fragmentShader: /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.2, 1.0, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
}
