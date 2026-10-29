import * as THREE from 'three'
import { PixelSky } from '../components/three/pixelSky'

/**
 * Foto pixel art del campus UAO tomada del mismo modelo 3D de la portada (para las viñetas de la
 * selección de emergencia). <CampusStage/> registra su renderer y su escena en `campusStage`.
 */
export const campusStage = { gl: null, scene: null, ready: false } // ready: el campus 3D ya cargó

const SIZE = 96 // píxeles por lado: se ve como pixel art al ampliarse en el círculo
const EYE = [-43, 5.8, 0] // de frente al Edificio Principal, como la portada, de cerca y al amanecer
const LOOK = [-20, 9.6, 0]
const FOV = 46
const SUN_ROW = 0.24 // altura del sol en la foto (0 arriba – 1 abajo): asoma justo sobre el techo
/** Luces del amanecer (los mismos valores que la portada en p = 0, ver StageRig). */
const DAWN = { hemi: ['#ffdcb8', '#7d7a5c', 1.45], sun: ['#ffc896', 2.2, [-40, 14, 22]] }

let cache = null

/** Devuelve un canvas SIZE×SIZE con el campus (o null si el campus 3D aún no terminó de cargar). */
export function campusSnapshot() {
  if (cache) return cache
  const { gl, scene, ready } = campusStage
  if (!gl || !scene || !ready) return null

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 800)
  camera.position.set(...EYE)
  camera.lookAt(...LOOK)
  camera.updateMatrixWorld()

  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { colorSpace: THREE.SRGBColorSpace })
  const prevTarget = gl.getRenderTarget()
  // Cielo y luces del amanecer solo para la foto (luego se deja la escena como estaba)
  let hemi, sun
  scene.traverse((o) => {
    if (o.isHemisphereLight) hemi = o
    if (o.isDirectionalLight) sun = o
  })
  const saved = {
    fog: scene.fog,
    background: scene.background,
    hemi: hemi && [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity],
    sun: sun && [sun.color.clone(), sun.intensity, sun.position.clone()],
  }
  const sky = new PixelSky()
  scene.fog = null // sin neblina: a esta escala solo desdibuja el edificio
  scene.background = sky.paint(0, 1, SUN_ROW)
  if (hemi) {
    hemi.color.set(DAWN.hemi[0])
    hemi.groundColor.set(DAWN.hemi[1])
    hemi.intensity = DAWN.hemi[2]
  }
  if (sun) {
    sun.color.set(DAWN.sun[0])
    sun.intensity = DAWN.sun[1]
    sun.position.set(...DAWN.sun[2])
  }
  gl.setRenderTarget(target)
  gl.render(scene, camera)
  gl.setRenderTarget(prevTarget)
  scene.fog = saved.fog
  scene.background = saved.background
  if (hemi) {
    hemi.color.copy(saved.hemi[0])
    hemi.groundColor.copy(saved.hemi[1])
    hemi.intensity = saved.hemi[2]
  }
  if (sun) {
    sun.color.copy(saved.sun[0])
    sun.intensity = saved.sun[1]
    sun.position.copy(saved.sun[2])
  }
  sky.texture.dispose()

  const pixels = new Uint8Array(SIZE * SIZE * 4)
  gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels)
  target.dispose()

  // WebGL lee de abajo hacia arriba: se voltea al copiar
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(SIZE, SIZE)
  const row = SIZE * 4
  for (let y = 0; y < SIZE; y++) img.data.set(pixels.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row)
  ctx.putImageData(img, 0, 0)
  cache = canvas
  return canvas
}
