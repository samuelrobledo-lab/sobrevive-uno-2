import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import escalerasUrl from '../../assets/models/escaleras.fbx?url'
import { makePixelTexture } from '../../utils/pixelTextures'
import { spriteToCanvas } from '../../utils/sprites'
import { BUSH, PLANT_PALETTE, TREE } from './CampusGround'

/**
 * Imagen de la ficha "Escaleras" del mapa, en el mismo estilo de los árboles del Mapa 3D: un sprite pixel art
 * de baja resolución, con colores planos (3 tonos por cara, sin luces), contorno suave más oscuro que cada pieza
 * (así se lee cada peldaño) y el jardín de fondo con los mismos árboles y arbustos del mapa.
 *
 * Se dibuja una sola vez a partir del modelo escaleras.fbx (visto como la foto del lugar, de cerca al tramo
 * que sube): piso de ladrillo en espiga, peldaños y muretes de piedra gris, columnas de ladrillo, techo claro
 * con tubería negra, letrero verde y pasamanos dorados.
 */

/** Tamaño del sprite (se amplía sin suavizado en la ficha, como los píxeles del mapa). */
export const SPRITE_W = 96
export const SPRITE_H = 72

/** Unidades del FBX → metros (un peldaño de 1147 unidades ≈ 17 cm). */
const S = 0.00015
/** Cámara: de cerca al tramo que sube (lo central de la foto). */
const VIEW = { eye: [3.2, 2.25, 0.7], look: [-2.6, 2.05, -0.38], fov: 50 }

/** Qué es cada pieza del modelo (nombres de Blender). */
const STEPS = /^Cube0(0[1-9]|1[01]|19|2[0-8])$/ // los dos tramos (sube y baja)
const STRINGERS = new Set(['Cube012', 'Cube013', 'Cube017', 'Cube018']) // muretes a los lados de los tramos
const KIND = (name) => {
  if (name === 'Cube') return 'floor'
  if (name === 'Cube016') return 'ceiling'
  if (STEPS.test(name) || STRINGERS.has(name) || name.startsWith('Cylinder')) return 'stone'
  return 'brick' // columnas y muros
}
/**
 * Material de cada tipo: color plano o textura pixel (repetición en metros, para que 1 texel ≈ 1 píxel del sprite).
 * Colores tomados de la foto, en tonos suaves como la paleta de las plantas del mapa.
 */
const MATERIALS = {
  floor: { map: 'brickFloor', tile: 1.8 },
  brick: { map: 'brickRed', tile: 1.6 },
  stone: { color: '#b4afa5' },
  ceiling: { color: '#e9e3d8' },
}
/** Piso bajo el tramo que baja (el modelo no lo trae y el tramo parecía flotar): [x0, x1, z0, z1, y] del FBX. */
const LOWER_FLOOR = [-32000, -6000, 4000, 24000, -4360]

/**
 * Tres tonos fijos por cara, según hacia dónde mira (como se sombrean los sprites del mapa, sin luces):
 * arriba/abajo (huellas, piso, techo) el más claro, de frente a la cámara (contrahuellas) medio, de lado oscuro.
 */
const FACE_TONE = { top: 1, front: 0.66, side: 0.48 }

/** UVs "de caja" en metros de escena, para que la textura tenga el mismo tamaño en todas las piezas. */
function boxUVs(mesh, tile) {
  const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(
    new THREE.Matrix4().makeScale(S, S, S).multiply(mesh.matrixWorld),
  )
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  const tone = new Float32Array(pos.count * 3)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    n.subVectors(b, a).cross(c.clone().sub(a))
    const [ax, ay, az] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    const t = ay >= ax && ay >= az ? FACE_TONE.top : ax >= az ? FACE_TONE.front : FACE_TONE.side
    tone.fill(t, i * 3, i * 3 + 9)
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]
      const [u, v] = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y]
      uv[(i + k) * 2] = u / tile
      uv[(i + k) * 2 + 1] = v / tile
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('color', new THREE.BufferAttribute(tone, 3))
  return geo
}

/** Pasamanos sobre los tramos: [x, y] del primer y último peldaño (FBX) y z de cada lado. */
const RAILS = [
  { from: [-8758, 7475], to: [-24363, 17692], z: [-7000, 1950] }, // tramo que sube
  { from: [-9055, 6432], to: [-24318, -3786], z: [6800] }, // tramo que baja (lado del murete central)
]
const RAIL_HEIGHT = 5800 // ≈ 87 cm sobre el borde de los peldaños

/** Tubería negra y lámpara del techo, y letrero verde colgado (unidades del FBX). */
const PIPES = [
  { z: -9000, y: 28600, r: 380 },
  { z: -7600, y: 28900, r: 300 },
  { z: 2500, y: 28300, r: 330 },
]
const CEILING_Y = 29900

function buildProps() {
  const metal = []
  const pipes = []
  RAILS.forEach(({ from: [x0, y0], to: [x1, y1], z }) => {
    const start = new THREE.Vector3(x0 * S, (y0 + RAIL_HEIGHT) * S, 0)
    const end = new THREE.Vector3(x1 * S, (y1 + RAIL_HEIGHT) * S, 0)
    const len = start.distanceTo(end)
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    z.forEach((zz) => {
      const mid = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .setZ(zz * S)
      metal.push(new THREE.BoxGeometry(len, 0.045, 0.045).rotateZ(angle).translate(mid.x, mid.y, mid.z))
      // parales cada ~1 m
      for (let t = 0.08; t <= 0.95; t += 0.29) {
        const p = start
          .clone()
          .lerp(end, t)
          .setZ(zz * S)
        metal.push(new THREE.BoxGeometry(0.035, 0.86, 0.035).translate(p.x, p.y - 0.43, p.z))
      }
    })
  })
  // tubos a lo largo del techo (de la cámara hacia el fondo) y sus soportes
  PIPES.forEach(({ z, y, r }) => {
    pipes.push(new THREE.CylinderGeometry(r * S, r * S, 6, 8).rotateZ(Math.PI / 2).translate(1.4, y * S, z * S))
    for (let x = -1; x < 4; x += 1.2)
      pipes.push(new THREE.BoxGeometry(0.03, (CEILING_Y - y) * S, 0.03).translate(x, ((CEILING_Y + y) / 2) * S, z * S))
  })
  return { metal, pipes }
}

/** Fondo: jardín con los mismos árboles y arbustos del mapa (se ve por las aberturas). */
function gardenBackground() {
  const c = document.createElement('canvas')
  c.width = SPRITE_W
  c.height = SPRITE_H
  const g = c.getContext('2d')
  g.fillStyle = '#e6efd9'
  g.fillRect(0, 0, SPRITE_W, SPRITE_H)
  g.fillStyle = '#a3c08a'
  g.fillRect(0, SPRITE_H * 0.62, SPRITE_W, SPRITE_H)
  const tree = spriteToCanvas(TREE, PLANT_PALETTE)
  const bush = spriteToCanvas(BUSH, PLANT_PALETTE)
  for (let x = -6; x < SPRITE_W; x += 13) g.drawImage(tree, x, SPRITE_H * 0.62 - tree.height + ((x / 13) % 2 ? 3 : 0))
  for (let x = 2; x < SPRITE_W; x += 17) g.drawImage(bush, x, SPRITE_H * 0.62 - 3)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function buildScene(fbx) {
  const scene = new THREE.Scene()
  scene.background = gardenBackground()
  // colores planos, sin luces: el sombreado lo dan los tonos por cara (FACE_TONE)
  const flat = (params) => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, ...params })
  const toned = (params) => flat({ vertexColors: true, ...params })
  const mats = Object.fromEntries(
    Object.entries(MATERIALS).map(([kind, { map, color }]) => {
      if (!map) return [kind, toned({ color })]
      const tex = makePixelTexture(map)
      tex.minFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      return [kind, toned({ map: tex })]
    }),
  )

  fbx.updateMatrixWorld(true)
  fbx.traverse((o) => {
    if (!o.isMesh) return
    const kind = KIND(o.name)
    scene.add(new THREE.Mesh(boxUVs(o, MATERIALS[kind].tile ?? 1), mats[kind]))
  })
  const [x0, x1, z0, z1, y] = LOWER_FLOOR
  const lower = new THREE.PlaneGeometry((x1 - x0) * S, (z1 - z0) * S).rotateX(-Math.PI / 2)
  lower.translate(((x0 + x1) / 2) * S, y * S, ((z0 + z1) / 2) * S)
  lower.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lower.attributes.position.count * 3).fill(1), 3))
  scene.add(new THREE.Mesh(lower, mats.stone))

  const { metal, pipes } = buildProps()
  // cada pasamanos y cada tubo como pieza aparte, para que lleven su propio contorno
  metal.forEach((geo) => scene.add(new THREE.Mesh(geo, flat({ color: '#d9b25a' }))))
  scene.add(new THREE.Mesh(mergeGeometries(pipes), flat({ color: '#34353a' })))
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.62), flat({ color: '#2f8f74' }))
  sign.position.set(8000 * S, 26000 * S, 11500 * S)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: '#fffdf6' }))
  lamp.position.set(3500 * S, (CEILING_Y - 80) * S, -1500 * S)
  scene.add(sign, lamp)
  return scene
}

/** Lee un render a un arreglo RGBA (de arriba hacia abajo). */
function renderPixels(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(SPRITE_W, SPRITE_H, { colorSpace: THREE.SRGBColorSpace })
  renderer.setRenderTarget(target)
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)
  const buf = new Uint8Array(SPRITE_W * SPRITE_H * 4)
  renderer.readRenderTargetPixels(target, 0, 0, SPRITE_W, SPRITE_H, buf)
  target.dispose()
  const out = new Uint8ClampedArray(buf.length)
  const row = SPRITE_W * 4
  for (let y = 0; y < SPRITE_H; y++) out.set(buf.subarray((SPRITE_H - 1 - y) * row, (SPRITE_H - y) * row), y * row)
  return out
}

/**
 * Contorno de 1 píxel entre piezas distintas (como la "k" de los sprites del mapa): se pinta con el mismo
 * color de la pieza, más oscuro. Para saber qué pieza es cada píxel se dibuja la escena con un color por pieza.
 */
function outline(color, scene, renderer, camera) {
  const meshes = []
  scene.traverse((o) => o.isMesh && meshes.push(o))
  const saved = meshes.map((m) => m.material)
  const background = scene.background
  meshes.forEach((m, i) => (m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHex(i + 1) })))
  scene.background = new THREE.Color(0)
  const ids = renderPixels(renderer, scene, camera)
  meshes.forEach((m, i) => {
    m.material.dispose()
    m.material = saved[i]
  })
  scene.background = background

  const id = (i) => (ids[i] << 16) | (ids[i + 1] << 8) | ids[i + 2]
  const out = new Uint8ClampedArray(color)
  const darken = (i) => {
    for (let k = 0; k < 3; k++) out[i + k] = color[i + k] * OUTLINE
  }
  for (let y = 0; y < SPRITE_H; y++)
    for (let x = 0; x < SPRITE_W; x++) {
      const i = (y * SPRITE_W + x) * 4
      for (const j of [x + 1 < SPRITE_W ? i + 4 : -1, y + 1 < SPRITE_H ? i + SPRITE_W * 4 : -1]) {
        if (j < 0 || id(i) === id(j)) continue
        // se oscurece la pieza (nunca el fondo del jardín)
        if (id(i)) darken(i)
        else darken(j)
      }
    }
  return out
}

/** Qué tan oscuro es el contorno respecto a su pieza (los árboles usan un verde casi negro). */
const OUTLINE = 0.4

let cache = null
/** Dibuja (una sola vez) el sprite de las escaleras y lo devuelve como ImageData. */
export async function drawEscaleras() {
  if (cache) return cache
  const fbx = await new FBXLoader().loadAsync(escalerasUrl)
  const scene = buildScene(fbx)
  const camera = new THREE.PerspectiveCamera(VIEW.fov, SPRITE_W / SPRITE_H, 0.05, 60)
  camera.position.set(...VIEW.eye)
  camera.lookAt(...VIEW.look)
  const renderer = new THREE.WebGLRenderer({ antialias: false, canvas: document.createElement('canvas') })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  try {
    const color = renderPixels(renderer, scene, camera)
    cache = new ImageData(outline(color, scene, renderer, camera), SPRITE_W, SPRITE_H)
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
  }
  return cache
}
