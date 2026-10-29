import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import campusUrl from '../../assets/models/mapa-uao.fbx?url'
import brickUrl from '../../assets/textures/ladrillo.png'
import concreteUrl from '../../assets/textures/concreto.png'
import { makePixelTexture, pixelateTexture } from '../../utils/pixelTextures'
import CampusGround from './CampusGround'
import CampusSurroundings from './CampusSurroundings'
import { PLATFORM_CUT_X } from '../../data/campusLayout'
import CourtyardDetails, { COURTYARD_WINDOWS } from './CourtyardDetails'
import { LONG_BUILDING_WINDOWS } from './longBuildingWindows'
import { FAR_BUILDING_WINDOWS } from './farBuildingWindows'
import CampusWindows from './CampusWindows'

const ALL_WINDOWS = [...COURTYARD_WINDOWS, ...LONG_BUILDING_WINDOWS, ...FAR_BUILDING_WINDOWS]

/**
 * Campus UAO a partir del modelo FBX entregado (mapa-uao.fbx).
 *
 * El FBX no trae materiales ni UVs, así que:
 *  1. Cada pieza se clasifica por nombre (ver PARTS) en pared / columna / balcón / techo / malla / plazoleta.
 *  2. Se generan UVs "de caja" en espacio mundo para que el pixel art quede a escala real y sin estirarse.
 *     En las paredes, las caras horizontales (pisos, terrazas, zócalos) usan baldosa en vez de ladrillo.
 *
 * Unidades del FBX ≈ milímetros → se escala ×0.001 y se centra en la plazoleta (y = 0 a nivel del piso).
 */

export const CAMPUS_SCALE = 0.001
export const CAMPUS_OFFSET = [-0.21, -5.34, -0.06]

const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(3, '0')}`)

/** Clasificación de piezas del FBX (nombres de Blender). */
const PARTS = {
  // Techos: losas superiores de los edificios + cúpula del edificio principal
  roof: new Set([
    'Cube003', 'Cube022', 'Cube024', 'Cube017', 'Cube018', 'Cube025', 'Cube026',
    'Cube014', 'Cube036', 'Cube061', 'Cube062', 'Cube028', 'Cube035',
  ]),
  // Edificios largos: las 4 columnas juntas del centro → ladrillo un poco más claro para que se distingan
  column: new Set([...range('Cube', 9, 12), ...range('Cube', 37, 40), ...range('Cube', 57, 60), ...range('Cube', 63, 66)]),
  // Edificios largos: balcones en medio círculo → concreto gris (como en la foto real).
  // Las columnas altas de los extremos son del mismo ladrillo de las paredes → categoría 'wall'.
  balcony: new Set([...range('Cylinder', 1, 8), ...range('Cylinder', 10, 17), ...range('Cylinder', 20, 35)]),
  plaza: new Set(['Cylinder046']),
  // Fuentes / estructuras en medio círculo junto a los edificios largos: tablas de madera
  wood: new Set(range('Cylinder', 37, 45)),
  // Techo en arco del edificio principal: malla transparente
  lattice: new Set(['Cylinder009']),
}

const kindOf = (name) => {
  for (const [kind, names] of Object.entries(PARTS)) if (names.has(name)) return kind
  return 'wall'
}

/** Tamaño (unidades FBX) que ocupa una repetición de cada textura. */
const TILE = { wall: 5200, column: 5200, balcony: 2600, roof: 4200, plaza: 3000, lattice: 1100, wood: 1500 }

/** Altura (unidades FBX) desde la cual una superficie superior de pared se considera azotea → textura de techo. */
const ROOFTOP_Y = 12500

/** Aclara un poco el ladrillo (multiplicador de color; 1 = textura original). */
const WALL_TINT = 1.15
/** Las columnas del centro, un toque más claras que las paredes. */
const COLUMN_TINT = 1.4

/**
 * UVs de caja: cada triángulo se proyecta sobre el plano de su eje dominante,
 * usando coordenadas de mundo (así todas las piezas comparten la misma escala).
 * Devuelve la geometría ya transformada a coordenadas del modelo, lista para unirse con las demás.
 * Si `splitFloors` es true, separa las caras en 3 geometrías (una por material):
 *   [0] paredes (ladrillo) · [1] pisos/terrazas (baldosa) · [2] azoteas (techo)
 * Así se completan los techos donde la losa del modelo no cubre todo el edificio.
 */
function boxUVGeometries(mesh, tile, splitFloors = false) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
  const pos = src.attributes.position
  const m = mesh.matrixWorld
  const flip = m.determinant() < 0 // escala negativa: invertir el orden para no voltear las caras
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const n = new THREE.Vector3()
  const w = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const out = [[], [], []].map(() => ({ pos: [], uv: [] }))
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) w[k].fromBufferAttribute(pos, i + (flip ? 2 - k : k)).applyMatrix4(m)
    a.copy(w[1]).sub(w[0])
    b.copy(w[2]).sub(w[0])
    n.crossVectors(a, b)
    const ax = Math.abs(n.x)
    const ay = Math.abs(n.y)
    const az = Math.abs(n.z)
    const horizontal = ay >= ax && ay >= az
    const rooftop = horizontal && n.y > 0 && w[0].y >= ROOFTOP_Y
    const slot = out[!splitFloors ? 0 : rooftop ? 2 : horizontal ? 1 : 0]
    for (const c of w) {
      let u
      let v
      if (horizontal) [u, v] = [c.x, c.z] // techo / piso
      else if (ax >= az) [u, v] = [c.z, c.y] // pared mirando a ±X
      else [u, v] = [c.x, c.y] // pared mirando a ±Z
      slot.pos.push(c.x, c.y, c.z)
      slot.uv.push(u / tile, v / tile)
    }
  }
  return out.map(({ pos: p, uv }) => {
    if (!p.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Acorta una pieza "aplastando" sobre el plano de corte los vértices que quedan más allá (x < cutX, en escena).
 * Sirve para prismas como la plataforma: su cara final queda justo en el corte, cerrada.
 */
function cutBeyondX(mesh, cutX) {
  const cut = (cutX - CAMPUS_OFFSET[0]) / CAMPUS_SCALE // a unidades del FBX
  const geo = mesh.geometry.clone()
  const pos = geo.attributes.position
  const inv = mesh.matrixWorld.clone().invert()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    if (v.x < cut) {
      v.x = cut
      v.applyMatrix4(inv)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  pos.needsUpdate = true
  mesh.geometry = geo
}

const repeatable = (tex) => {
  const t = pixelateTexture(tex)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Materiales del campus (se crean una sola vez y se comparten entre escenas). */
let materialsCache = null
function campusMaterials(brick, concrete) {
  if (materialsCache) return materialsCache
  const roof = new THREE.MeshLambertMaterial({ map: makePixelTexture('roofAqua') })
  const paving = new THREE.MeshLambertMaterial({ map: makePixelTexture('stone', 1, 1) }) // pisos / terrazas
  materialsCache = {
    wall: [new THREE.MeshLambertMaterial({ map: repeatable(brick), color: new THREE.Color().setScalar(WALL_TINT) }), paving, roof], // + azoteas sin losa
    column: [new THREE.MeshLambertMaterial({ map: repeatable(brick), color: new THREE.Color().setScalar(COLUMN_TINT) }), paving, roof],
    balcony: [new THREE.MeshLambertMaterial({ map: repeatable(concrete) })],
    roof: [roof],
    plaza: [new THREE.MeshLambertMaterial({ map: makePixelTexture('terracotta') })],
    wood: [new THREE.MeshLambertMaterial({ map: makePixelTexture('wood') })],
    lattice: [
      new THREE.MeshLambertMaterial({ map: makePixelTexture('lattice'), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ],
  }
  return materialsCache
}

/**
 * Procesa el FBX una sola vez por variante (portada / mapa) y une todas las piezas que comparten material:
 * de ~120 mallas pasa a 8, lo que reduce mucho las llamadas de dibujo por cuadro.
 */
const modelCache = new Map()
function buildCampus(fbx, brick, concrete, frontView) {
  const key = frontView ? 'front' : 'full'
  if (modelCache.get(key)?.fbx === fbx) return modelCache.get(key).meshes
  const materials = campusMaterials(brick, concrete)
  const root = fbx.clone(true)
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const center = new THREE.Vector3()
  const byMaterial = new Map()
  root.traverse((o) => {
    if (!o.isMesh) return
    if (frontView && o.name !== 'Cylinder046' && box.setFromObject(o).getCenter(center).x > -2790) return
    const kind = kindOf(o.name)
    // Plataforma del Edificio Principal: más corta, cortada en PLATFORM_CUT_X
    if (o.name === 'Cube075') cutBeyondX(o, PLATFORM_CUT_X)
    boxUVGeometries(o, TILE[kind], kind === 'wall' || kind === 'column').forEach((geo, slot) => {
      if (!geo) return
      const mat = materials[kind][slot]
      if (!byMaterial.has(mat)) byMaterial.set(mat, [])
      byMaterial.get(mat).push(geo)
    })
  })
  const meshes = [...byMaterial].map(([material, geos]) => {
    const geometry = mergeGeometries(geos)
    geos.forEach((g) => g.dispose())
    const mesh = new THREE.Mesh(geometry, material)
    mesh.matrixAutoUpdate = false
    return mesh
  })
  modelCache.set(key, { fbx, meshes })
  return meshes
}

/**
 * @param {boolean} frontView  vista de portada: oculta los edificios al este de la plazoleta
 *                             (no aparecen en la foto de la entrada) para encuadrar el Edificio Principal.
 */
export default function UaoCampus({ frontView = false }) {
  const fbx = useLoader(FBXLoader, campusUrl)
  const [brick, concrete] = useTexture([brickUrl, concreteUrl])
  // Copias livianas (comparten geometría y material): un objeto 3D solo puede estar en una escena,
  // y la portada y el mapa pueden estar montados a la vez durante la transición.
  const meshes = useMemo(
    () => buildCampus(fbx, brick, concrete, frontView).map((m) => m.clone()),
    [fbx, brick, concrete, frontView],
  )

  return (
    <group>
      {/* Suelo pixel art: pasto, caminos, lago, rocas y vegetación (boceto del equipo) */}
      <CampusGround frontView={frontView} />
      {/* Alrededores: calles, valla, árboles y pasto hasta el horizonte */}
      <CampusSurroundings />
      {/* Patio del Edificio Principal: moldura del arco, ventanas, franjas grises y seto */}
      <CourtyardDetails />
      {/* Todas las ventanas del campus (3 llamadas de dibujo en total) */}
      <CampusWindows specs={frontView ? COURTYARD_WINDOWS : ALL_WINDOWS} />
      <group scale={CAMPUS_SCALE} position={CAMPUS_OFFSET}>
        {meshes.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
      </group>
    </group>
  )
}

useLoader.preload(FBXLoader, campusUrl)
