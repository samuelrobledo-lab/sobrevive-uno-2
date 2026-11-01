import * as THREE from 'three'
import { useMemo } from 'react'

/**
 * Texturas pixel art procedurales (canvas 2D → THREE.CanvasTexture).
 * Todas usan NearestFilter y sin mipmaps para conservar el pixelado.
 * Se usan en los modelos FBX del campus y de los sótanos (que no traen materiales).
 */

/** PRNG determinista para que las texturas sean estables entre renders. */
export function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shade = (hex, amt) => {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, amt)
  return `#${c.getHexString()}`
}

const px = (ctx, x, y, color, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

const noise = (ctx, size, base, spread, seed, w = size) => {
  const r = rng(seed)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < w; x++) px(ctx, x, y, shade(base, (r() - 0.5) * spread))
}

/* ------------------------------------------------------------------ */
/* Recetas                                                             */
/* ------------------------------------------------------------------ */

const RECIPES = {
  concrete: [32, (ctx, s) => {
    noise(ctx, s, '#6d6c74', 0.06, 3)
    const r = rng(9)
    for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#55545b', 2, 1)
    ctx.fillStyle = '#5c5b63'
    ctx.fillRect(0, 0, s, 1)
    ctx.fillRect(0, 0, 1, s)
  }],

  // Sótanos: piso de granito pulido (terrazo) en baldosas, gris cálido medio (no tan blanco)
  terrazzo: [32, (ctx, s) => {
    noise(ctx, s, '#a7a39a', 0.035, 13)
    const r = rng(17)
    const chips = ['#86837b', '#949188', '#bebab0', '#b6b2a8', '#8c897f'] // motas suaves, como el granito pulido
    for (let i = 0; i < 50; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), chips[i % chips.length])
    // junta entre baldosas
    px(ctx, 0, 0, '#8d8a83', s, 1)
    px(ctx, 0, 0, '#8d8a83', 1, s)
  }],

  // Sótanos: muro pintado blanco hueso con zócalo gris de granito (abajo = nivel del piso)
  whiteWall: [64, (ctx, s) => {
    noise(ctx, s, '#e2ddd3', 0.02, 19)
    const r = rng(23)
    for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * (s - 8)), '#d6d0c5', 1, 1) // marcas leves
    const base = s - 3
    for (let y = base; y < s; y++) for (let x = 0; x < s; x++) px(ctx, x, y, r() < 0.2 ? '#6f6c66' : r() < 0.4 ? '#9a978f' : '#86837c')
    px(ctx, 0, base - 1, '#bdb7ac', s, 1) // borde del zócalo
  }],

  asphalt: [32, (ctx, s) => {
    noise(ctx, s, '#3a3940', 0.07, 5)
  }],

  parkingLine: [16, (ctx, s) => {
    noise(ctx, s, '#3a3940', 0.06, 7)
    px(ctx, 6, 0, '#e8c33a', 4, s)
  }],

  brick: [32, (ctx, s) => {
    px(ctx, 0, 0, '#6e3b2a', s, s)
    const r = rng(11)
    for (let row = 0; row < s / 4; row++) {
      const off = row % 2 ? 4 : 0
      for (let col = -1; col < s / 8 + 1; col++) {
        const c = shade('#b5552f', (r() - 0.5) * 0.12)
        px(ctx, col * 8 + off, row * 4, c, 7, 3)
      }
    }
  }],

  wallPaint: [16, (ctx, s) => {
    noise(ctx, s, '#8d8a93', 0.04, 13)
    px(ctx, 0, s - 4, '#c8102e', s, 3) // franja institucional
  }],

  facade: [32, (ctx, s) => {
    RECIPES.brick[1](ctx, s)
    const r = rng(21)
    for (let y = 4; y < s; y += 14)
      for (let x = 3; x < s; x += 10) {
        px(ctx, x - 1, y - 1, '#e9dcc8', 7, 9)
        px(ctx, x, y, r() > 0.7 ? '#ffd877' : '#2b3550', 5, 7)
        px(ctx, x + 2, y, '#e9dcc8', 1, 7)
      }
  }],

  roof: [16, (ctx, s) => {
    noise(ctx, s, '#8c8a86', 0.06, 17)
  }],

  grass: [16, (ctx, s) => {
    noise(ctx, s, '#4f9a45', 0.1, 23)
    const r = rng(29)
    for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#7cc45f', 1, 2)
  }],

  stone: [16, (ctx, s) => {
    px(ctx, 0, 0, '#a99d88', s, s)
    const r = rng(31)
    for (let y = 0; y < s; y += 8)
      for (let x = 0; x < s; x += 8) px(ctx, x, y, shade('#d4c8ae', (r() - 0.5) * 0.08), 7, 7)
  }],

  terracotta: [16, (ctx, s) => {
    px(ctx, 0, 0, '#5a2a22', s, s)
    const r = rng(37)
    for (let y = 0; y < s; y += 4)
      for (let x = 0; x < s; x += 4) px(ctx, x, y, shade('#a2483a', (r() - 0.5) * 0.12), 3, 3)
    px(ctx, 0, 7, '#e0b25a', s, 1)
  }],

  water: [16, (ctx, s) => {
    noise(ctx, s, '#3a8fc4', 0.06, 41)
    px(ctx, 3, 4, '#9fd6f0', 4, 1)
    px(ctx, 9, 11, '#9fd6f0', 4, 1)
  }],

  hazardStripes: [16, (ctx, s) => {
    px(ctx, 0, 0, '#1b1b1f', s, s)
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) if (((x + y) >> 2) % 2 === 0) px(ctx, x, y, '#f0c419')
  }],

  elevator: [32, (ctx, s) => {
    px(ctx, 0, 0, '#3e4047', s, s)
    px(ctx, 3, 2, '#b8bec8', 26, 30)
    for (let y = 2; y < 32; y += 3) px(ctx, 3, y, '#a3a9b3', 26, 1)
    px(ctx, 15, 2, '#5d626b', 2, 30)
  }],

  // Escaleras y salida: ladrillo naranja en aparejo de soga (como el campus), junta clara
  brickRed: [32, (ctx, s) => {
    px(ctx, 0, 0, '#d8b39b', s, s)
    const r = rng(37)
    const tones = ['#c8613f', '#d26a45', '#bf5838', '#d57653', '#b85234', '#cc6a4a']
    for (let row = 0; row < s / 4; row++) {
      const off = row % 2 ? 4 : 0
      for (let x = -off; x < s; x += 8) {
        const tone = tones[Math.floor(r() * tones.length)]
        for (let k = 0; k < 7; k++) px(ctx, (x + k + s) % s, row * 4, tone, 1, 3)
      }
    }
  }],

  // Peldaños: baldosa de terracota brillante con junta clara
  tileTread: [32, (ctx, s) => {
    px(ctx, 0, 0, '#d9a68b', s, s)
    const r = rng(41)
    for (let y = 0; y < s; y += 8)
      for (let x = 0; x < s; x += 4) {
        const tone = shade('#c85a32', (r() - 0.5) * 0.08)
        px(ctx, x, y, tone, 3, 7)
        px(ctx, x, y, shade(tone, 0.08), 3, 1) // brillo
      }
  }],

  // Descansos: ladrillo en espiga (rojo oscuro) con junta
  herringbone: [32, (ctx, s) => {
    const r = rng(43)
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const k = ((x >> 2) + (y >> 2)) & 1
        const mortar = k ? y % 4 === 3 : x % 4 === 3
        px(ctx, x, y, mortar ? '#c58a70' : shade('#9c3a24', (r() - 0.5) * 0.06))
      }
  }],

  // Ficha "Escaleras": piso de ladrillo en espiga como la foto (ladrillos 2:1 cruzados, junta clara)
  brickFloor: [32, (ctx, s) => {
    const W = 4 // ancho de un ladrillo (largo = 2W); el patrón se repite con (W, W) y (2W, −2W)
    px(ctx, 0, 0, '#b07a62', s, s) // junta
    const r = rng(61)
    const brick = (x, y, w, h) => {
      const tone = shade('#c4593a', (r() - 0.5) * 0.1)
      for (const dx of [0, -s, s]) for (const dy of [0, -s, s]) px(ctx, x + dx, y + dy, tone, w - 1, h - 1)
    }
    for (let n = 0; n < s / W; n++)
      for (let m = -2; m < 2; m++) {
        const x = (((n * W + m * 2 * W) % s) + s) % s
        const y = (((n * W - m * 2 * W) % s) + s) % s
        brick(x, y, 2 * W, W) // acostado
        brick(x, y + W, W, 2 * W) // parado
      }
  }],

  // Vidrio de la salida: jardín y luz de afuera
  outsideView: [32, (ctx, s) => {
    px(ctx, 0, 0, '#eef4e6', s, s)
    const r = rng(47)
    const greens = ['#7fb466', '#5f9a50', '#9cc77a', '#4f8746']
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * s)
      const y = 10 + Math.floor(r() * (s - 10))
      px(ctx, x, y, greens[i % greens.length], 2 + Math.floor(r() * 3), 2 + Math.floor(r() * 3))
    }
    px(ctx, 0, s - 3, '#c9c3b5', s, 3) // andén afuera
  }],

  // Sótano 1: puertas de ascensor en acero inoxidable cepillado (dos hojas)
  steelDoor: [32, (ctx, s) => {
    const r = rng(29)
    for (let x = 0; x < s; x++) {
      const streak = r() < 0.25 ? 0.06 : r() < 0.25 ? -0.05 : 0
      for (let y = 0; y < s; y++) px(ctx, x, y, shade('#b7bbc0', streak + (r() - 0.5) * 0.03))
    }
    px(ctx, 9, 4, '#e4e7ea', 3, 18) // brillo
    px(ctx, 22, 8, '#dde0e4', 2, 14)
    px(ctx, 15, 0, '#6f7378', 2, s) // unión de las dos hojas
    px(ctx, 0, 0, '#8d9196', 1, s)
    px(ctx, s - 1, 0, '#8d9196', 1, s)
  }],

  // Sótano 1: letrero amarillo "Ascensor" con flechas y pictograma
  elevatorSign: [32, (ctx, s) => {
    px(ctx, 0, 0, '#f1cd3c', s, s)
    px(ctx, 0, 0, '#c9a51f', s, 1)
    px(ctx, 0, s - 1, '#c9a51f', s, 1)
    const k = '#2b2a26'
    // texto (rayitas)
    px(ctx, 3, 3, k, 9, 2)
    // flechas ↓↑
    px(ctx, 20, 8, k, 1, 7)
    px(ctx, 19, 13, k, 3, 1)
    px(ctx, 25, 8, k, 1, 7)
    px(ctx, 24, 9, k, 3, 1)
    // pictograma: cabina con tres personas
    px(ctx, 18, 17, k, 11, 12)
    px(ctx, 19, 18, '#f1cd3c', 9, 10)
    for (const x of [20, 23, 26]) {
      px(ctx, x, 20, k, 1, 1)
      px(ctx, x, 22, k, 1, 5)
    }
  }],

  exitSign: [32, (ctx, s) => {
    px(ctx, 0, 0, '#0e7a3a', s, s)
    px(ctx, 1, 1, '#18a957', s - 2, s - 2)
    // flecha
    px(ctx, 6, 14, '#ffffff', 16, 4)
    for (let i = 0; i < 6; i++) px(ctx, 20 + i, 10 + i, '#ffffff', 1, 12 - i * 2)
    // persona corriendo (pixel)
    px(ctx, 8, 5, '#ffffff', 3, 3)
    px(ctx, 7, 8, '#ffffff', 4, 4)
    px(ctx, 6, 20, '#ffffff', 2, 6)
    px(ctx, 10, 20, '#ffffff', 2, 6)
  }],

  meetingSign: [32, (ctx, s) => {
    px(ctx, 0, 0, '#0e7a3a', s, s)
    px(ctx, 2, 2, '#18a957', s - 4, s - 4)
    // 4 flechas hacia el centro (símbolo de punto de encuentro)
    const w = '#ffffff'
    px(ctx, 14, 4, w, 4, 6); px(ctx, 12, 9, w, 8, 2)
    px(ctx, 14, 22, w, 4, 6); px(ctx, 12, 21, w, 8, 2)
    px(ctx, 4, 14, w, 6, 4); px(ctx, 9, 12, w, 2, 8)
    px(ctx, 22, 14, w, 6, 4); px(ctx, 21, 12, w, 2, 8)
    px(ctx, 14, 14, w, 4, 4)
  }],

  // Techos del campus: aguamarina medio con tejas pixel
  roofAqua: [32, (ctx, s) => {
    noise(ctx, s, '#4aa596', 0.05, 47)
    const r = rng(53)
    for (let y = 0; y < s; y += 8) {
      px(ctx, 0, y, '#3b8a7d', s, 1)
      for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) px(ctx, x, y, '#3b8a7d', 1, 8)
      px(ctx, 0, y + 1, '#6cc2b1', s, 1)
    }
    for (let i = 0; i < 14; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), r() > 0.5 ? '#79cdbb' : '#3f9284')
  }],

  // Malla / celosía transparente (techo en arco del edificio principal)
  lattice: [16, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    px(ctx, 0, 0, 'rgba(70, 86, 92, 0.22)', s, s) // vidrio ahumado tenue
    px(ctx, 0, 0, 'rgba(78, 86, 90, 0.95)', s, 1) // perfiles horizontales (gris oscuro)
    px(ctx, 0, 0, 'rgba(78, 86, 90, 0.95)', 1, s) // perfiles verticales
    px(ctx, 0, s / 2, 'rgba(96, 104, 108, 0.75)', s, 1) // perfil secundario
  }],

  // Follaje de setos (verdes apagados)
  leaves: [16, (ctx, s) => {
    noise(ctx, s, '#6e9659', 0.06, 61)
    const r = rng(67)
    for (let i = 0; i < 22; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), r() > 0.5 ? '#8db574' : '#4f7442', 2, 1)
    for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#9cc283')
  }],

  // Ramas que cuelgan del seto: arriba lleno, abajo con borde irregular (transparente)
  leavesDrape: [16, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const r = rng(71)
    for (let x = 0; x < s; x++) {
      const len = 5 + Math.floor(r() * 9)
      for (let y = 0; y < len; y++) px(ctx, x, y, y === len - 1 ? '#4f7442' : r() > 0.8 ? '#8db574' : '#6e9659')
    }
  }],

  // Tablas de madera (fuentes / estructuras en medio círculo)
  wood: [32, (ctx, s) => {
    const r = rng(83)
    for (let y = 0; y < s; y += 8) {
      const base = ['#8a6446', '#7f5b3e', '#946d4c', '#86603f'][(y / 8) % 4]
      px(ctx, 0, y, base, s, 8)
      // vetas
      for (let i = 0; i < 5; i++) px(ctx, Math.floor(r() * s), y + 2 + Math.floor(r() * 4), '#6e4e34', 3 + Math.floor(r() * 5), 1)
      px(ctx, 0, y + 1, '#a07a56', s, 1) // brillo superior de la tabla
      px(ctx, 0, y + 7, '#4f3726', s, 1) // junta entre tablas
      // uniones escalonadas + clavos
      const j = ((y / 8) % 2 ? 6 : 22)
      px(ctx, j, y, '#4f3726', 1, 8)
      px(ctx, j + 2, y + 3, '#3c2a1d')
      px(ctx, j - 3, y + 3, '#3c2a1d')
    }
  }],

  rubble: [16, (ctx, s) => {
    noise(ctx, s, '#8a8378', 0.14, 43)
  }],
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const canvasCache = new Map()

function getCanvas(name) {
  if (canvasCache.has(name)) return canvasCache.get(name)
  const recipe = RECIPES[name]
  if (!recipe) throw new Error(`Textura pixel desconocida: ${name}`)
  const [size, draw] = recipe
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d'), size)
  canvasCache.set(name, canvas)
  return canvas
}

/**
 * Filtrado "pixel art" estable:
 *  - de cerca (magnificación) → Nearest: píxeles nítidos
 *  - de lejos (minificación) → mipmaps: sin parpadeo ni moiré al mover la cámara
 */
export function pixelateTexture(tex) {
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Crea una textura pixel (comparte el canvas, cada instancia tiene su propio repeat). */
export function makePixelTexture(name, repeatX = 1, repeatY = repeatX) {
  const tex = new THREE.CanvasTexture(getCanvas(name))
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  return pixelateTexture(tex)
}

/** Hook memoizado para usar en componentes R3F. */
export function usePixelTexture(name, repeatX = 1, repeatY = repeatX) {
  return useMemo(() => makePixelTexture(name, repeatX, repeatY), [name, repeatX, repeatY])
}
