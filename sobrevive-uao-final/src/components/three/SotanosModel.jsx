import { useEffect, useMemo } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as THREE from 'three'
import sotanosUrl from '../../assets/models/sotanos.fbx?url'
import { makePixelTexture } from '../../utils/pixelTextures'
import { BASEMENT_OFFSET, BASEMENT_SCALE, LEVEL, nav } from './basementLayout'
import SotanosFurniture from './SotanosFurniture'
import SotanoDecor from './SotanoDecor'
import LabsTables from './LabsTables'

/**
 * Sótanos de la UAO a partir del modelo entregado (sotanos.fbx). Solo se usa en el simulador.
 *
 * - Materiales como en las fotos: piso de granito pulido (terrazo) en baldosas y muros blanco hueso con
 *   zócalo gris; en las escaleras y la salida (costado este) muros de ladrillo, peldaños de baldosa de
 *   terracota y descansos de ladrillo en espiga. UVs "de caja" en espacio de escena (el zócalo queda a la
 *   altura del piso de cada sótano).
 * - Solo se ve el nivel donde está el personaje: dos cortes horizontales siguen su altura.
 *   En el Sótano 2 no se ve nada por encima de su cabeza (el piso del Sótano 1 taparía la cámara);
 *   al subir la rampa o las escaleras el Sótano 1 va apareciendo y el Sótano 2 va desapareciendo por debajo,
 *   y en el Sótano 1 ya no se ve nada del Sótano 2 (al bajar pasa lo contrario).
 * - Registra pisos y muros en `nav` para que el avatar camine sobre el modelo real.
 */

/** Piezas del FBX por función (nombres de Blender). */
const FLOORS = new Set(['Plane', 'Plane001']) // pisos de ambos niveles (+ la rampa)
/** Puertas provisionales del modelo en los nichos de los ascensores: se quitan (ver SotanosFurniture). */
const DOORS = new Set(['Cube005', 'Cube006', 'Cube008', 'Cube009'])
/**
 * Escaleras del costado este (dos, cada una con dos tramos y un descanso): son muchas piezas pequeñas,
 * así que se reconocen por forma: cajas bajas (< 40 cm de alto en el modelo) al este del corredor.
 * Se pintan como piso y el avatar las sube como la rampa (cada peldaño es un desnivel pequeño).
 */
const STAIRS_FROM_X = 24000 // unidades del FBX
const STEP_MAX_HEIGHT = 400
const isStep = (o) => {
  const b = new THREE.Box3().setFromObject(o)
  return b.min.x > STAIRS_FROM_X && b.max.y - b.min.y < STEP_MAX_HEIGHT
}

/**
 * Huecos del modelo donde el piso no llega hasta el muro (se veía una franja negra): se rellenan con piso.
 * [x0, x1, z0, z1, y] en unidades del FBX; y = nivel del piso (1804 Sótano 2, 3322 Sótano 1).
 */
const S2_Y = 1804
const S1_Y = 3322
const FLOOR_PATCHES = [
  [9850, 19900, 7800, 8250, S2_Y], // franja al sur del patio central
  [17350, 19900, -6250, -5850, S2_Y], // franja al norte del patio central
  // esquinas del patio, en los dos sótanos
  ...[
    [-9350, -8000],
    [-5900, -4550],
    [6400, 7750],
    [10150, 11500],
  ].flatMap(([z0, z1]) => [S2_Y, S1_Y].map((y) => [6100, 6550, z0, z1, y])),
  [7450, 7750, -8750, -8000, S1_Y],
]

const FLOOR_TILE = 1.6 // una baldosa de piso (unidades de escena)
const WALL_TILE = LEVEL.s1 // la textura de muro se repite cada piso, así el zócalo cae a ras de cada nivel
const ABOVE = 2.3 // se ve hasta esta altura sobre los pies del avatar (en el Sótano 2 queda bajo el piso del Sótano 1)
const BELOW = 1.1 // y hasta esta profundidad bajo sus pies (en el Sótano 1 deja fuera los muros del Sótano 2)

/** Materiales por cara (índices del arreglo de materiales de cada pieza). */
const M = { floor: 0, wall: 1, brick: 2, tread: 3, landing: 4 }
/** Al este de esta x (escena) están las escaleras y la salida: muros de ladrillo, como en las fotos. */
const EAST_X = 33.0
const BRICK_TILE = 1.0
const TREAD_TILE = 0.8
const LANDING_WIDTH = 1000 // unidades del FBX: los descansos son las "cajas bajas" más anchas

/**
 * UVs de caja en coordenadas de escena + material por cara.
 * `pick(centro, horizontal)` → [índice de material (M), tamaño de la repetición de su textura].
 * Las caras se agrupan por material (una sola malla, varios materiales).
 */
const sceneOffset = new THREE.Vector3(...BASEMENT_OFFSET)
function boxUVs(mesh, pick) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  const pos = geo.attributes.position
  const m = new THREE.Matrix4().makeScale(BASEMENT_SCALE, BASEMENT_SCALE, BASEMENT_SCALE).multiply(mesh.matrixWorld)
  const w = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const n = new THREE.Vector3()
  const e = new THREE.Vector3()
  const c = new THREE.Vector3()
  const uv = new Float32Array(pos.count * 2)
  const buckets = Object.values(M).map(() => [])
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) w[k].fromBufferAttribute(pos, i + k).applyMatrix4(m).add(sceneOffset)
    n.subVectors(w[1], w[0]).cross(e.subVectors(w[2], w[0]))
    const [ax, ay, az] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    const horizontal = ay >= ax && ay >= az
    c.copy(w[0]).add(w[1]).add(w[2]).divideScalar(3)
    const [mat, tile] = pick(c, horizontal)
    buckets[mat].push(i, i + 1, i + 2)
    for (let k = 0; k < 3; k++) {
      const p = w[k]
      const [u, v] = horizontal ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y]
      uv[(i + k) * 2] = u / tile
      uv[(i + k) * 2 + 1] = v / tile
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(buckets.flat())
  let start = 0
  buckets.forEach((list, mat) => {
    if (list.length) geo.addGroup(start, list.length, mat)
    start += list.length
  })
  geo.computeVertexNormals()
  mesh.geometry = geo
}

/** Qué material lleva cada cara según la pieza (piso, peldaño, descanso o muro) y dónde está. */
function facePicker(o) {
  const east = (c) => c.x > EAST_X
  if (o.userData.step) {
    const b = new THREE.Box3().setFromObject(o)
    const landing = b.max.x - b.min.x > LANDING_WIDTH
    return () => (landing ? [M.landing, TREAD_TILE] : [M.tread, TREAD_TILE])
  }
  if (o.userData.walkable)
    // pisos: terrazo; los muretes que vienen en la misma pieza (junto a las escaleras) son de ladrillo
    return (c, horizontal) =>
      east(c) && (!horizontal || c.y > LEVEL.s1 + 0.5) ? [M.brick, BRICK_TILE] : [M.floor, FLOOR_TILE]
  return (c) => (east(c) ? [M.brick, BRICK_TILE] : [M.wall, WALL_TILE])
}

const repeatTex = (name) => {
  const t = makePixelTexture(name)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export default function SotanosModel({ avatarRef }) {
  const fbx = useLoader(FBXLoader, sotanosUrl)
  const gl = useThree((s) => s.gl)

  const { root, top, bottom, planes } = useMemo(() => {
    const top = new THREE.Plane(new THREE.Vector3(0, -1, 0), ABOVE) // conserva y < constante
    const bottom = new THREE.Plane(new THREE.Vector3(0, 1, 0), BELOW) // conserva y > −constante
    const mat = (name) =>
      new THREE.MeshLambertMaterial({
        map: repeatTex(name),
        side: THREE.DoubleSide,
        clippingPlanes: [top, bottom],
      })
    // en el orden de M
    const materials = [mat('terrazzo'), mat('whiteWall'), mat('brickRed'), mat('tileTread'), mat('herringbone')]
    const root = fbx.clone(true)
    // Rellenos de piso (un poquito por debajo del piso real, para no "pelear" donde se superponen)
    FLOOR_PATCHES.forEach(([x0, x1, z0, z1, y], i) => {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2))
      patch.position.set((x0 + x1) / 2, y - 3, (z0 + z1) / 2)
      patch.name = `FloorPatch${i}`
      FLOORS.add(patch.name)
      root.add(patch)
    })
    root.updateMatrixWorld(true)
    root.traverse((o) => {
      if (!o.isMesh) return
      // antes de boxUVs (usa la geometría original)
      o.userData.step = isStep(o)
      o.userData.walkable = FLOORS.has(o.name) || o.userData.step
      boxUVs(o, facePicker(o))
      o.material = materials
    })
    const doors = []
    root.traverse((o) => DOORS.has(o.name) && doors.push(o))
    doors.forEach((o) => o.removeFromParent())
    return { root, top, bottom, planes: [top, bottom] }
  }, [fbx])

  // Navegación: pisos y muros del modelo (los raycasts usan sus matrices de escena)
  useEffect(() => {
    gl.localClippingEnabled = true
    const meshes = []
    root.traverse((o) => o.isMesh && meshes.push(o))
    nav.floors = meshes
    nav.walls = meshes.filter((o) => !o.userData.walkable)
    return () => {
      nav.floors = []
      nav.walls = []
    }
  }, [root, gl])

  // Los cortes siguen la altura del avatar (suavizados por si reaparece en otro punto al reintentar)
  useFrame((_, dt) => {
    const y = avatarRef.current.y
    const k = Math.min(1, dt * 8)
    top.constant += (y + ABOVE - top.constant) * k
    bottom.constant += (BELOW - y - bottom.constant) * k
  })

  return (
    <group>
      <group scale={BASEMENT_SCALE} position={BASEMENT_OFFSET}>
        <primitive object={root} />
      </group>
      {/* Mesas y ascensores del Sótano 1 */}
      <SotanosFurniture clippingPlanes={planes} />
      {/* Decoración de los sótanos (modelos del equipo) y mesas de labs 1 */}
      <SotanoDecor clippingPlanes={planes} />
      <LabsTables clippingPlanes={planes} />
    </group>
  )
}

useLoader.preload(FBXLoader, sotanosUrl)
