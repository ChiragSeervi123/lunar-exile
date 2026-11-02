import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Sphere, Vector3 } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { PLANET_TERRAIN } from '@/config/planet'
import type { Planet } from '@/game/planet'
import type { SurfacePaletteDef } from '@/types/content'
import { vec3, type Vec3 } from '@/utils/vec3'
import { createChunkBuilder, type ChunkBuilder } from './chunkBuilder'
import type { ChunkMesh, ChunkPalette, RGB } from './chunkMesh'
import { createLodSelection, selectLod, type ChunkBounds, type LodSelection } from './lod'
import { withPlanetShadow } from './planetShadow'
import { planetTerrainStatus } from './terrainStatus'

interface ChunkRecord {
  mesh: Mesh
  bounds: ChunkBounds
  triangles: number
  /** Frame it was last part of the view (or its ancestry). */
  lastUsed: number
}

interface TerrainState {
  builder: ChunkBuilder
  records: Map<number, ChunkRecord>
  shown: Set<number>
  selection: LodSelection
  frame: number
  camera: Vec3
  started: number
}

interface PlanetTerrainProps {
  planet: Planet
  palette: SurfacePaletteDef
  /** Deepest chunk level and split distance, from the graphics quality. */
  depth: number
  split: number
}

const linear = (hex: string): RGB => {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}

/** A drawable mesh for a finished chunk, hidden until the level of detail picks it. */
function chunkRecord(chunk: ChunkMesh, material: MeshStandardMaterial, frame: number): ChunkRecord {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(chunk.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(chunk.normals!, 3))
  geometry.setAttribute('color', new BufferAttribute(chunk.colors!, 3))
  geometry.setIndex(new BufferAttribute(chunk.indices, 1))
  geometry.boundingSphere = new Sphere(new Vector3(), chunk.radius)
  const mesh = new Mesh(geometry, material)
  mesh.position.set(...chunk.center)
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.visible = false
  planetTerrainStatus.built++
  planetTerrainStatus.buildMs += (chunk.buildMs - planetTerrainStatus.buildMs) * 0.1
  return { mesh, bounds: { center: vec3(...chunk.center), radius: chunk.radius }, triangles: chunk.indices.length / 3, lastUsed: frame }
}

/**
 * The Moon's surface as a cube-sphere of chunks: finer near the camera, coarser with distance,
 * hidden behind the horizon. Chunks are built by background workers, uploaded a few per frame and
 * swapped in only once complete, so the ground never shows holes; old chunks are freed.
 */
export function PlanetTerrain({ planet, palette, depth, split }: PlanetTerrainProps) {
  const group = useRef<Group>(null)
  const state = useRef<TerrainState | null>(null)
  const material = useMemo(
    () => withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0 })),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const root = group.current
    if (!root) return
    const chunkPalette: ChunkPalette = {
      highlands: linear(palette.highlands),
      maria: linear(palette.maria),
      craterFloor: linear(palette.craterFloor),
      ejecta: linear(palette.ejecta),
    }
    const workers = Math.min(PLANET_TERRAIN.maxWorkers, Math.max(1, (navigator.hardwareConcurrency || 4) - 2))
    const builder = createChunkBuilder(
      planet,
      { resolution: PLANET_TERRAIN.chunkResolution, jitter: PLANET_TERRAIN.jitter, palette: chunkPalette },
      workers,
      PLANET_TERRAIN.maxInFlight,
    )
    const records = new Map<number, ChunkRecord>()
    const add = (chunk: ChunkMesh) => {
      if (records.has(chunk.key)) return
      const record = chunkRecord(chunk, material, 0)
      root.add(record.mesh)
      records.set(chunk.key, record)
    }
    // The six face roots straight away, so the whole Moon is there from the first frame.
    for (let face = 0; face < 6; face++) add(builder.buildNow({ face, depth: 0, ix: 0, iy: 0 }))
    planetTerrainStatus.ready = false
    state.current = { builder, records, shown: new Set(), selection: createLodSelection(), frame: 0, camera: vec3(), started: performance.now() }

    return () => {
      builder.dispose()
      for (const record of records.values()) {
        root.remove(record.mesh)
        record.mesh.geometry.dispose()
      }
      records.clear()
      state.current = null
      planetTerrainStatus.ready = false
    }
  }, [planet, palette, material])

  useFrame(({ camera }) => {
    const s = state.current
    const root = group.current
    if (!s || !root) return
    s.frame++
    const { records, builder, selection, shown } = s

    for (const chunk of builder.take(PLANET_TERRAIN.uploadsPerFrame)) {
      if (records.has(chunk.key)) continue
      const record = chunkRecord(chunk, material, s.frame)
      root.add(record.mesh)
      records.set(chunk.key, record)
    }

    s.camera.x = camera.position.x
    s.camera.y = camera.position.y
    s.camera.z = camera.position.z
    selectLod(s.camera, (key) => records.get(key)?.bounds, { radius: planet.radius, minHeight: planet.minHeight, maxDepth: depth, split }, selection)

    for (const key of selection.visited) {
      const record = records.get(key)
      if (record) record.lastUsed = s.frame
    }
    let triangles = 0
    const next = new Set(selection.display)
    for (const key of shown) {
      if (!next.has(key)) {
        const record = records.get(key)
        if (record) record.mesh.visible = false
      }
    }
    for (const key of next) {
      const record = records.get(key)!
      record.mesh.visible = true
      triangles += record.triangles
    }
    s.shown = next

    builder.wish(selection.wanted.filter((w) => !records.has(w.key)).slice(0, 64))

    // Free the least recently used chunks once over budget (never the face roots).
    if (records.size > PLANET_TERRAIN.cacheSize + 32) {
      const old = [...records.entries()]
        .filter(([key, r]) => r.lastUsed < s.frame && !next.has(key) && Math.floor(key / 16777216) >= 6)
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      for (const [key, record] of old.slice(0, records.size - PLANET_TERRAIN.cacheSize)) {
        root.remove(record.mesh)
        record.mesh.geometry.dispose()
        records.delete(key)
      }
    }

    planetTerrainStatus.displayed = next.size
    planetTerrainStatus.cached = records.size
    planetTerrainStatus.queued = builder.queued
    planetTerrainStatus.inFlight = builder.inFlight
    planetTerrainStatus.triangles = triangles
    if (!planetTerrainStatus.ready) {
      const settled = builder.queued === 0 && builder.inFlight === 0 && selection.wanted.length === 0
      // Lift the cover once the first view is complete, or after a few seconds regardless.
      if (settled || performance.now() - s.started > 6000) planetTerrainStatus.ready = true
    }
  }, FRAME_PRIORITY.followers)

  return <group ref={group} name="moon-terrain" />
}
