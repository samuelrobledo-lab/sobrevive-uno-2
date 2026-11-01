import { useMemo } from 'react'
import * as THREE from 'three'
import { AGORAS, FOUNTAIN_ROCKS, LAKES, MAIN_BUILDING_PLANTINGS, PATHS, PATH_AREAS, PATH_RINGS, PLANTINGS, ROCKS, isOnPath } from '../../data/campusLayout'
import { pixelateTexture, rng } from '../../utils/pixelTextures'
import { spriteToTexture } from '../../utils/sprites'

/**
 * Suelo del campus en pixel art, pintado en una sola textura:
 * pasto (tono apagado), caminos con borde de luz/sombra y lago con orilla.
 * Árboles, arbustos y rocas son sprites 2D con sombra proyectada en el suelo (ilusión de 3D).
 * Las posiciones vienen de data/campusLayout.js (boceto del equipo).
 */

const EXTENT = { x: 170, z: 120 } // tamaño del suelo en unidades de escena (centrado en 0,0)
const PPU = 6 // píxeles de textura por unidad → tamaño del "pixel" del suelo

/* ------------------------------------------------------------------ */
/* Paleta suave (poco saturada para no cansar la vista)                */
/* ------------------------------------------------------------------ */
export const C = {
  grass: [122, 145, 104],
  grassLight: [138, 160, 118],
  grassDark: [106, 128, 92],
  pathShadow: [98, 112, 84],
  path: [212, 199, 168],
  pathLight: [226, 216, 190],
  pathDark: [186, 172, 140],
  rim: [196, 186, 158],
  water: [132, 174, 170],
  waterDeep: [110, 150, 148],
  waterLight: [172, 204, 197],
  agoraStep: [200, 190, 166],
  agoraLip: [222, 214, 192],
  agoraRiser: [128, 116, 96],
  agoraStage: [176, 160, 128],
}

/* ------------------------------------------------------------------ */
/* Sprites de vegetación                                               */
/* ------------------------------------------------------------------ */
export const PLANT_PALETTE = {
  k: '#3f5338', // contorno verde oscuro (más suave que el negro)
  L: '#a3c08a',
  G: '#7fa16b',
  D: '#5f8053',
  T: '#7c604a',
  P: '#d8aab3', // flores
}

export const TREE = [
  '.....kkkkkk.....',
  '...kkLLLLLLkk...',
  '..kLLLLGGLLLLk..',
  '.kLLGGGGGGGLLLk.',
  '.kLGGGGGGGGGGLk.',
  'kLGGGGGGGGGGGGDk',
  'kLGGGGGGGGGGGGDk',
  'kGGGGGGGGGGGGDDk',
  'kGGGGGGGGGGGDDDk',
  '.kGGGGGGGGGDDDk.',
  '.kDGGGGGGDDDDDk.',
  '..kDDDDDDDDDDk..',
  '...kkkDTTDkkk...',
  '.....kkTTkk.....',
  '......kTTk......',
  '......kTTk......',
  '.....kTTTTk.....',
]
export const BUSH = [
  '...kkkkkk...',
  '.kkLLGGLLkk.',
  'kLLGGGGGGDDk',
  'kGGGGGGGGDDk',
  'kGGGGGGGDDDk',
  '.kDDDDDDDDk.',
  '..kkkkkkkk..',
]
const FLOWER_BUSH = [
  '...kkkkkk...',
  '.kkLPGGLPkk.',
  'kLPGGGPGGDDk',
  'kGGGPGGGPDDk',
  'kGPGGGGGDDDk',
  '.kDDDDDDDDk.',
  '..kkkkkkkk..',
]

const ROCK = [
  '..kkkk..',
  '.kLLRRk.',
  'kLRRRRDk',
  'kRRRRDDk',
  '.kDDDDk.',
  '..kkkk..',
]
const ROCK_FLAT = [
  '.kkkkkk.',
  'kLLRRRDk',
  'kRRRRDDk',
  '.kkkkkk.',
]
const ROCK_PALETTE = { k: '#55544f', L: '#cfccc2', R: '#a8a69c', D: '#7f7d75' }

const PLANTS = {
  tree: { rows: TREE, w: 1.9, shadow: [0.95, 0.5] },
  bush: { rows: BUSH, w: 1.3, shadow: [0.7, 0.32] },
  flowers: { rows: FLOWER_BUSH, w: 1.3, shadow: [0.7, 0.32] },
  rock: { rows: ROCK, w: 0.75, shadow: [0.42, 0.2], palette: ROCK_PALETTE },
  rockFlat: { rows: ROCK_FLAT, w: 0.7, shadow: [0.4, 0.16], palette: ROCK_PALETTE },
}
const PATTERN = ['tree', 'bush', 'flowers', 'tree', 'bush']
const SPACING = 1.5

/** Reparte plantas a lo largo de cada trazo del boceto. */
function layoutPlants() {
  const r = rng(91)
  const out = []
  let n = 0
  ;[...PLANTINGS, ...MAIN_BUILDING_PLANTINGS].forEach((line) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i]
      const [bx, bz] = line[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const steps = Math.max(1, Math.round(len / SPACING))
      for (let s = 0; s < steps; s++) {
        const t = s / steps
        out.push({
          kind: PATTERN[n++ % PATTERN.length],
          x: ax + (bx - ax) * t + (r() - 0.5) * 0.4,
          z: az + (bz - az) * t + (r() - 0.5) * 0.4,
        })
      }
    }
    const [lx, lz] = line[line.length - 1]
    out.push({ kind: 'bush', x: lx, z: lz })
  })
  // Rocas junto al lago y alrededor de las fuentes
  // (ninguna roca encima de un camino)
  ;[...ROCKS, ...FOUNTAIN_ROCKS]
    .filter((p) => !isOnPath(p))
    .forEach(([x, z], k) => out.push({ kind: k % 3 ? 'rock' : 'rockFlat', x, z }))
  return out
}

/* ------------------------------------------------------------------ */
/* Pintado del suelo                                                   */
/* ------------------------------------------------------------------ */
const W = EXTENT.x * PPU
const H = EXTENT.z * PPU
const toPx = (x, z) => [(x + EXTENT.x / 2) * PPU, (z + EXTENT.z / 2) * PPU]

/** Dibuja con canvas y devuelve una máscara de bordes duros (sin antialias → pixel art). */
function mask(draw) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.fillStyle = g.strokeStyle = '#fff'
  g.lineCap = g.lineJoin = 'round'
  draw(g)
  const d = g.getImageData(0, 0, W, H).data
  const m = new Uint8Array(W * H)
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0
  return m
}

const polyline = (g, points) => {
  g.beginPath()
  points.forEach(([x, z], i) => (i ? g.lineTo(...toPx(x, z)) : g.moveTo(...toPx(x, z))))
}

function paintGround(plants) {
  const img = new ImageData(W, H)
  const px = img.data
  const r = rng(17)
  const set = (i, [cr, cg, cb], jitter = 0) => {
    const j = jitter ? Math.round((r() - 0.5) * jitter) : 0
    px[i * 4] = cr + j
    px[i * 4 + 1] = cg + j
    px[i * 4 + 2] = cb + j
    px[i * 4 + 3] = 255
  }
  const darken = (i, f) => {
    px[i * 4] *= f
    px[i * 4 + 1] *= f
    px[i * 4 + 2] *= f
  }

  // 1. Pasto apagado con briznas sueltas
  for (let i = 0; i < W * H; i++) {
    const v = r()
    set(i, v < 0.04 ? C.grassLight : v < 0.08 ? C.grassDark : C.grass, 4)
  }

  // 2. Sombras de árboles y arbustos (desplazadas abajo-derecha: luz desde arriba-izquierda)
  const shade = mask((g) => {
    plants.forEach(({ kind, x, z }) => {
      const [sx, sz] = PLANTS[kind].shadow
      g.beginPath()
      g.ellipse(...toPx(x + 0.25, z + 0.2), sx * PPU, sz * PPU, 0, 0, Math.PI * 2)
      g.fill()
    })
  })
  for (let i = 0; i < W * H; i++) if (shade[i]) darken(i, 0.82)

  // 3. Caminos con relieve: sombra inferior + borde claro arriba + borde oscuro abajo
  const drawPaths = (g, dy = 0) => {
    g.save()
    g.translate(0, dy)
    PATHS.forEach(({ width, points }) => {
      g.lineWidth = width * PPU
      polyline(g, points)
      g.stroke()
    })
    PATH_AREAS.forEach((poly) => {
      polyline(g, poly)
      g.closePath()
      g.fill()
    })
    PATH_RINGS.forEach(({ center, radius, width }) => {
      g.lineWidth = width * PPU
      g.beginPath()
      g.arc(...toPx(...center), radius * PPU, 0, Math.PI * 2)
      g.stroke()
    })
    g.restore()
  }
  const pathShadow = mask((g) => drawPaths(g, 3))
  const path = mask((g) => drawPaths(g))
  for (let i = 0; i < W * H; i++) if (pathShadow[i] && !path[i]) set(i, C.pathShadow, 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!path[i]) continue
      const up = y > 0 && path[i - W]
      const down = y < H - 1 && path[i + W]
      set(i, !up ? C.pathLight : !down ? C.pathDark : C.path, 6)
    }

  // 4. Lago: orilla, agua con sombra del borde y reflejos
  LAKES.forEach(({ center, rx, rz }) => {
    const [cx, cz] = toPx(...center)
    const rim = mask((g) => {
      g.beginPath()
      g.ellipse(cx, cz, (rx + 0.45) * PPU, (rz + 0.45) * PPU, 0, 0, Math.PI * 2)
      g.fill()
    })
    const water = mask((g) => {
      g.beginPath()
      g.ellipse(cx, cz, rx * PPU, rz * PPU, 0, 0, Math.PI * 2)
      g.fill()
    })
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (!rim[i]) continue
        if (!water[i]) set(i, C.rim, 6)
        else {
          const nearTop = y > 2 && (!water[i - W] || !water[i - 2 * W] || !water[i - 3 * W])
          set(i, nearTop ? C.waterDeep : C.water, 4)
        }
      }
    // reflejos horizontales
    for (let k = 0; k < 10; k++) {
      const x = Math.round(cx + (r() - 0.5) * rx * PPU)
      const y = Math.round(cz + (r() - 0.2) * rz * PPU * 0.9)
      for (let d = 0; d < 3; d++) {
        const i = y * W + x + d
        if (water[i]) set(i, C.waterLight)
      }
    }
  })

  // 5. Ágora: gradas concéntricas que bajan hacia el centro (más oscuras = más profundas),
  //    con borde claro arriba de cada grada y contrahuella oscura → ilusión de hueco
  AGORAS.forEach(({ center, radius, steps }) => {
    const [cx, cy] = toPx(...center)
    const R = radius * PPU
    for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++)
      for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > R) continue
        const i = y * W + x
        const t = d / R // 0 centro → 1 borde
        const k = Math.min(steps, Math.floor(t * (steps + 1))) // 0 = escenario
        if (k === 0) {
          set(i, C.agoraStage, 4)
          continue
        }
        const f = 1 - (steps - k) * 0.09 // cada grada más abajo, más oscura
        const inBand = t * (steps + 1) - k // 0..1 dentro de la grada
        const edge = inBand < 0.28 ? C.agoraRiser : inBand > 0.85 ? C.agoraLip : C.agoraStep
        set(i, edge.map((v) => v * f), 3)
      }
  })

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.getContext('2d').putImageData(img, 0, 0)
  return canvas
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */
/**
 * Material de "sprite instanciado": cada instancia es un plano que siempre mira a la cámara
 * (como un THREE.Sprite), pero todas las plantas de un tipo se dibujan en una sola llamada.
 * La escala de la instancia da el ancho/alto del sprite; su base queda a nivel del suelo.
 */
export function billboardMaterial(map) {
  const mat = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, toneMapped: false })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      mvPosition.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
      gl_Position = projectionMatrix * mvPosition;`,
    )
  }
  return mat
}

/** Plano unitario con el ancla abajo al centro (equivale a `center={[0.5, 0.05]}` de un sprite). */
export const BILLBOARD_GEO = new THREE.PlaneGeometry(1, 1).translate(0, 0.45, 0)

/** Suelo pintado + vegetación instanciada; se calcula una sola vez por variante y se reutiliza entre escenas. */
const groundCache = new Map()
function buildGround(frontView) {
  if (groundCache.has(frontView)) return groundCache.get(frontView)
  const plants = layoutPlants().filter((p) => !frontView || p.x < -1.5)
  const groundTexture = pixelateTexture(new THREE.CanvasTexture(paintGround(plants)))
  // De cerca se ve pixelado (Nearest); de lejos usa mipmaps para evitar el "moiré" en el pasto
  groundTexture.generateMipmaps = true
  groundTexture.minFilter = THREE.LinearMipmapLinearFilter
  groundTexture.anisotropy = 4
  const m = new THREE.Matrix4()
  const instances = Object.entries(PLANTS).flatMap(([kind, p]) => {
    const list = plants.filter((pl) => pl.kind === kind)
    if (!list.length) return []
    const h = (p.w * p.rows.length) / p.rows[0].length
    return [{ kind, material: billboardMaterial(spriteToTexture(p.rows, p.palette ?? PLANT_PALETTE)), matrices: list.map(({ x, z }) => m.makeScale(p.w, h, 1).setPosition(x, 0, z).clone()) }]
  })
  const result = { groundTexture, instances }
  groundCache.set(frontView, result)
  return result
}

export function PlantInstances({ material, matrices }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(BILLBOARD_GEO, material, matrices.length)
    matrices.forEach((mat, i) => im.setMatrixAt(i, mat))
    im.frustumCulled = false // el plano gira hacia la cámara: la caja de la instancia no sirve para descartar
    return im
  }, [material, matrices])
  return <primitive object={mesh} />
}

/** @param {boolean} frontView  portada: sin vegetación ni rocas al este de la plazoleta (quedarían frente a la cámara) */
export default function CampusGround({ frontView = false }) {
  const { groundTexture, instances } = useMemo(() => buildGround(frontView), [frontView])

  return (
    <group>
      {/* Un poco "hacia atrás" en profundidad: la plazoleta y bases del modelo (casi a la misma altura) siempre quedan encima */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[EXTENT.x, EXTENT.z]} />
        <meshLambertMaterial map={groundTexture} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
      </mesh>
      {/* Árboles, arbustos y rocas: una llamada de dibujo por tipo */}
      {instances.map(({ kind, material, matrices }) => (
        <PlantInstances key={kind} material={material} matrices={matrices} />
      ))}
    </group>
  )
}
