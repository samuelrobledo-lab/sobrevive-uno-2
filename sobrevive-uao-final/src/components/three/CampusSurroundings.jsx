import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../../utils/pixelTextures'
import { spriteToTexture } from '../../utils/sprites'
import { C, PLANT_PALETTE, PlantInstances, TREE, billboardMaterial } from './CampusGround'
import CampusParking from './CampusParking'

/**
 * Entorno del campus (según Google Maps), para que la UAO no flote en una plataforma:
 *  - suelo de pasto que se pierde en el horizonte (la niebla esconde el borde)
 *  - Calle 25 al oeste (doble calzada), Carrera 115 al norte, Carrera 116 al sur y Calle 42 al este
 *  - valla alrededor del campus (muro bajo de concreto + reja metálica), con portones donde llegan los caminos
 *  - parqueadero al costado norte (ver CampusParking)
 *  - bosque de la Hacienda Cañasgordas al oeste, árboles en las calles y grupos dispersos alrededor
 *
 * Orientación de la escena: norte = −z, este = +x (igual que el mapa).
 * Todo se calcula una vez y se comparte entre la portada y el mapa.
 */

/* ------------------------------------------------------------------ */
/* Datos                                                               */
/* ------------------------------------------------------------------ */
const GROUND_SIZE = 2000

/** Calles: centro, ancho y largo; `ns` = norte-sur, `ew` = este-oeste. */
const ROADS = [
  { name: 'Calle 25 (sur → norte)', x: -48.5, z: 0, w: 5, len: 900, dir: 'ns', lanes: 'oneWay' },
  { name: 'Calle 25 (norte → sur)', x: -55.5, z: 0, w: 5, len: 900, dir: 'ns', lanes: 'oneWay' },
  { name: 'Calle 42', x: 51, z: 0, w: 6, len: 900, dir: 'ns', lanes: 'twoWay' },
  // desde el borde de la Calle 25 hacia el este
  { name: 'Carrera 115', x: 227, z: -30.5, w: 6, len: 546, dir: 'ew', lanes: 'twoWay' }, // tras el parqueadero del costado norte
  { name: 'Carrera 116', x: 227, z: 25, w: 6, len: 546, dir: 'ew', lanes: 'twoWay' },
]
const SIDEWALK = 1.4

/**
 * Capas planas del suelo: además de una altura distinta, cada una tiene su prioridad de profundidad
 * (polygonOffset), así nunca "pelean" entre sí al mover la cámara (sin parpadeo).
 * Más negativo = se dibuja encima. El suelo detallado del campus queda en 0.
 */
const LAYER = {
  outerGround: { y: -0.06, offset: 4 }, // detrás del suelo del campus
  shadow: { y: 0.012, offset: -1 },
  sidewalkNS: { y: 0.02, offset: -2 },
  sidewalkEW: { y: 0.025, offset: -3 },
  roadNS: { y: 0.03, offset: -4 }, // las calles tapan los andenes en los cruces
  roadEW: { y: 0.04, offset: -5 },
}
const layered = (name) => ({ polygonOffset: true, polygonOffsetFactor: LAYER[name].offset, polygonOffsetUnits: LAYER[name].offset })

/** Valla: rectángulo alrededor del campus y aberturas (portones) donde llegan los caminos. */
const FENCE = { x: [-44, 46.5], z: [-24.5, 21.5], base: 0.4, height: 1.5 } // muro bajo + reja encima
const GATES = {
  west: [[-3.5, 3.5]], // explanada
  north: [[-13, -7]], // entrada vehicular al parqueadero
  south: [[0.8, 4.4]],
  east: [[11, 15]],
}

/* ------------------------------------------------------------------ */
/* Texturas pixel                                                      */
/* ------------------------------------------------------------------ */
const canvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
const rgb = ([r, g, b], j = 0) => `rgb(${r + j},${g + j},${b + j})`

/** Pasto igual al del campus (mismos tonos y briznas), para que no se note la unión. */
function grassTile() {
  const S = 96
  const c = canvas(S, S)
  const g = c.getContext('2d')
  const r = rng(23)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = r()
      g.fillStyle = rgb(v < 0.04 ? C.grassLight : v < 0.08 ? C.grassDark : C.grass, Math.round((r() - 0.5) * 4))
      g.fillRect(x, y, 1, 1)
    }
  return c
}

/** Asfalto con bordes blancos y línea central (amarilla doble sentido / blanca discontinua un sentido). */
function roadTile(lanes) {
  const W = 32
  const H = 32
  const c = canvas(W, H)
  const g = c.getContext('2d')
  const r = rng(lanes === 'oneWay' ? 5 : 7)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      g.fillStyle = rgb([92, 94, 98], Math.round((r() - 0.5) * 10))
      g.fillRect(x, y, 1, 1)
    }
  g.fillStyle = '#d9d6cc'
  g.fillRect(1, 0, 1, H)
  g.fillRect(W - 2, 0, 1, H)
  g.fillStyle = lanes === 'oneWay' ? '#e4e1d6' : '#e8c34a'
  g.fillRect(W / 2 - 1, 0, 2, H / 2)
  return c
}

/** Andén de concreto en baldosas. */
function sidewalkTile() {
  const c = canvas(16, 16)
  const g = c.getContext('2d')
  const r = rng(11)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      g.fillStyle = rgb([196, 192, 182], Math.round((r() - 0.5) * 8))
      g.fillRect(x, y, 1, 1)
    }
  g.fillStyle = '#a9a59a'
  g.fillRect(0, 15, 16, 1)
  g.fillRect(15, 0, 1, 16)
  return c
}

/** Reja metálica: barrotes gruesos con baranda arriba y abajo (fondo transparente). */
function fenceTile() {
  const c = canvas(16, 24)
  const g = c.getContext('2d')
  g.fillStyle = '#26302b'
  g.fillRect(0, 1, 16, 3)
  g.fillRect(0, 21, 16, 3)
  for (let x = 1; x < 16; x += 5) g.fillRect(x, 0, 2, 24)
  g.fillStyle = '#5a6a60' // brillo
  g.fillRect(0, 1, 16, 1)
  for (let x = 1; x < 16; x += 5) g.fillRect(x, 0, 1, 24)
  return c
}

const tex = (c, rx = 1, ry = 1) => {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  return t
}

/* ------------------------------------------------------------------ */
/* Árboles                                                             */
/* ------------------------------------------------------------------ */
const FOREST_PALETTE = { ...PLANT_PALETTE, L: '#8fb07a', G: '#6c915c', D: '#4f7147' } // un poco más oscuro

/** ¿(x, z) cae sobre una calle, su andén o dentro de la valla? (ahí no van árboles) */
function blocked(x, z) {
  if (x > FENCE.x[0] - 2 && x < FENCE.x[1] + 2 && z > FENCE.z[0] - 2 && z < FENCE.z[1] + 2) return true
  return ROADS.some(({ x: rx, z: rz, w, len, dir }) => {
    const half = w / 2 + SIDEWALK + 1
    return dir === 'ns'
      ? Math.abs(x - rx) < half && Math.abs(z - rz) < len / 2
      : Math.abs(z - rz) < half && Math.abs(x - rx) < len / 2
  })
}

function layoutTrees() {
  const r = rng(77)
  const trees = []
  const add = (x, z, w) => !blocked(x, z) && trees.push({ x, z, w })
  // Bosque de la Hacienda Cañasgordas (al oeste de la Calle 25): denso y alto
  for (let x = -62; x > -175; x -= 3.3)
    for (let z = -220; z < 220; z += 3.3) if (r() > 0.18) add(x + (r() - 0.5) * 2.4, z + (r() - 0.5) * 2.4, 3.4 + r() * 1.6)
  // Árboles a lo largo de las calles (lado de afuera)
  for (let x = -40; x < 260; x += 5.5) {
    add(x + r(), -30.5 - 6, 2.6 + r() * 0.8) // Carrera 115
    add(x + r(), 25 + 6, 2.6 + r() * 0.8) // Carrera 116
  }
  for (let z = -250; z < 250; z += 5.5) add(51 + 6, z + r(), 2.6 + r() * 0.8) // Calle 42
  // Grupos dispersos: barrios al norte, potreros al sur y al este
  for (let i = 0; i < 900; i++) {
    const x = -45 + r() * 290
    const z = (r() - 0.5) * 380
    if (r() < 0.45) add(x, z, 2.4 + r() * 1.6)
  }
  return trees
}

/* ------------------------------------------------------------------ */
/* Construcción (una sola vez)                                         */
/* ------------------------------------------------------------------ */
let cache = null
function build() {
  if (cache) return cache
  const ground = tex(grassTile(), GROUND_SIZE / 16, GROUND_SIZE / 16)
  const roadTex = { oneWay: tex(roadTile('oneWay')), twoWay: tex(roadTile('twoWay')) }
  const sidewalk = tex(sidewalkTile())
  const fence = tex(fenceTile())

  // Calles y andenes (mismas texturas, cada una con su propio repeat)
  const roads = ROADS.map((road) => {
    const map = roadTex[road.lanes].clone()
    map.repeat.set(1, road.len / 6)
    const walk = sidewalk.clone()
    walk.repeat.set(SIDEWALK / 1.4, road.len / 1.4)
    const ew = road.dir === 'ew'
    return { ...road, map, walk, road: ew ? 'roadEW' : 'roadNS', walkLayer: ew ? 'sidewalkEW' : 'sidewalkNS' }
  })

  // Valla: tramos de cada lado sin los portones
  const segments = []
  const side = (from, to, gaps, place) => {
    const cuts = [from, ...gaps.flat(), to]
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > 0.1) segments.push(place(cuts[i], cuts[i + 1]))
  }
  const { x: [x0, x1], z: [z0, z1] } = FENCE
  side(x0, x1, GATES.north, (a, b) => ({ pos: [(a + b) / 2, z0], len: b - a, rot: 0 }))
  side(x0, x1, GATES.south, (a, b) => ({ pos: [(a + b) / 2, z1], len: b - a, rot: 0 }))
  side(z0, z1, GATES.west, (a, b) => ({ pos: [x0, (a + b) / 2], len: b - a, rot: Math.PI / 2 }))
  side(z0, z1, GATES.east, (a, b) => ({ pos: [x1, (a + b) / 2], len: b - a, rot: Math.PI / 2 }))
  const fences = segments.map((s) => {
    const map = fence.clone()
    map.repeat.set(s.len / 1.2, 1)
    return { ...s, map }
  })
  // Columnas de concreto a cada lado de los portones
  const pillars = [
    ...GATES.north.flat().map((x) => [x, z0]),
    ...GATES.south.flat().map((x) => [x, z1]),
    ...GATES.west.flat().map((z) => [x0, z]),
    ...GATES.east.flat().map((z) => [x1, z]),
  ]

  // Árboles (instanciados) + sus sombras en el suelo
  const trees = layoutTrees()
  const m = new THREE.Matrix4()
  const h = TREE.length / TREE[0].length
  const forestMat = billboardMaterial(spriteToTexture(TREE, FOREST_PALETTE))
  const treeMatrices = trees.map(({ x, z, w }) => m.makeScale(w, w * h, 1).setPosition(x, 0, z).clone())
  const shadowMatrices = trees.map(({ x, z, w }) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x + w * 0.13, LAYER.shadow.y, z + w * 0.1),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      new THREE.Vector3(w * 0.5, w * 0.27, 1),
    ),
  )

  cache = { ground, roads, fences, pillars, forestMat, treeMatrices, shadowMatrices }
  return cache
}

const SHADOW_GEO = new THREE.CircleGeometry(1, 10)
const SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: '#1d2a18',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  ...layered('shadow'),
})

function Shadows({ matrices }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(SHADOW_GEO, SHADOW_MAT, matrices.length)
    matrices.forEach((mat, i) => im.setMatrixAt(i, mat))
    return im
  }, [matrices])
  return <primitive object={mesh} />
}

export default function CampusSurroundings() {
  const { ground, roads, fences, pillars, forestMat, treeMatrices, shadowMatrices } = useMemo(build, [])

  return (
    <group>
      {/* Pasto hasta el horizonte (bajo el suelo detallado del campus) */}
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.outerGround.y}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshLambertMaterial map={ground} {...layered('outerGround')} />
      </mesh>

      {/* Calles con andenes a ambos lados */}
      {roads.map(({ name, x, z, w, len, dir, map, walk, road, walkLayer }) => (
        <group key={name} position={[x, 0, z]} rotation-y={dir === 'ew' ? Math.PI / 2 : 0}>
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER[road].y}>
            <planeGeometry args={[w, len]} />
            <meshLambertMaterial map={map} {...layered(road)} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} rotation-x={-Math.PI / 2} position={[s * (w / 2 + SIDEWALK / 2), LAYER[walkLayer].y, 0]}>
              <planeGeometry args={[SIDEWALK, len]} />
              <meshLambertMaterial map={walk} {...layered(walkLayer)} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Valla perimetral (muro bajo + reja) y columnas de los portones */}
      {fences.map(({ pos: [x, z], len, rot, map }) => (
        <group key={`${x}${z}`} position={[x, 0, z]} rotation-y={rot}>
          <mesh position-y={FENCE.base / 2}>
            <boxGeometry args={[len, FENCE.base, 0.3]} />
            <meshLambertMaterial color="#d8d2c4" />
          </mesh>
          <mesh position-y={FENCE.base + FENCE.height / 2}>
            <planeGeometry args={[len, FENCE.height]} />
            <meshLambertMaterial map={map} transparent alphaTest={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {pillars.map(([x, z]) => (
        <mesh key={`p${x}${z}`} position={[x, (FENCE.base + FENCE.height + 0.3) / 2, z]}>
          <boxGeometry args={[0.6, FENCE.base + FENCE.height + 0.3, 0.6]} />
          <meshLambertMaterial color="#e2dccf" />
        </mesh>
      ))}

      {/* Parqueadero (costado norte) */}
      <CampusParking />

      {/* Árboles alrededor (una llamada de dibujo) y sus sombras (otra) */}
      <Shadows matrices={shadowMatrices} />
      <PlantInstances material={forestMat} matrices={treeMatrices} />
    </group>
  )
}
