import * as THREE from 'three'
import { pixelateTexture, rng } from './pixelTextures'

/**
 * Sprites pixel art definidos como matrices de caracteres.
 * Cada carácter = 1 píxel según la paleta indicada ('.' = transparente).
 * (Los personajes usan spritesheets PNG: ver data/characters.js.)
 */

/** Dibuja una matriz de sprite en un canvas nuevo (tamaño 1px por celda). */
export function spriteToCanvas(rows, palette) {
  const w = Math.max(...rows.map((r) => r.length))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = rows.length
  const ctx = canvas.getContext('2d')
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || !palette[ch]) return
      ctx.fillStyle = palette[ch]
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  return canvas
}

export function spriteToTexture(rows, palette) {
  return pixelateTexture(new THREE.CanvasTexture(spriteToCanvas(rows, palette)))
}

/* ------------------------------------------------------------------ */
/* Iconos UI pixel (se renderizan como <rect> SVG en PixelIcon)        */
/* ------------------------------------------------------------------ */

const mirror = (grid) => grid.map((r) => [...r].reverse().join(''))
const ARROW_LEFT = ['..#.....', '.##.....', '########', '########', '.##.....', '..#.....']

export const ICONS = {
  home: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.', '.##..##.'],
  back: ARROW_LEFT,
  next: mirror(ARROW_LEFT),
  retry: ['..####.#', '.#....##', '#....###', '#.......', '#......#', '#......#', '.#....#.', '..####..'],
  close: ['##....##', '.##..##.', '..####..', '...##...', '..####..', '.##..##.', '##....##'],
  pin: ['..####..', '.######.', '###..###', '###..###', '.######.', '..####..', '...##...', '...##...'],
  check: ['.......#', '......##', '.....##.', '#...##..', '##.##...', '.###....', '..#.....'],
  map: ['##..##..', '#.##.###', '#.##.#.#', '#.##.#.#', '#.##.#.#', '###.##.#', '..##..##'],
  soundOn: ['...#....', '..##..#.', '####.#.#', '####.#.#', '####.#.#', '..##..#.', '...#....'],
  soundOff: ['...#....', '..##....', '####.#.#', '####..#.', '####.#.#', '..##....', '...#....'],
  plus: ['...##...', '...##...', '########', '########', '...##...', '...##...'],
  minus: ['........', '........', '########', '########', '........', '........'],
  help: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...'],
  eye: ['..####..', '.#....#.', '#..##..#', '#..##..#', '.#....#.', '..####..'],
}

/* ------------------------------------------------------------------ */
/* Viñetas pixel para la selección de amenaza (hover = emergencia)     */
/* ------------------------------------------------------------------ */

/**
 * Dibuja el campus UAO en pixel art (48x36) con la variante de emergencia.
 * variant: 'base' | 'quake' | 'fire' | 'gas'; frame anima llamas/humo.
 */
export function drawCampusVignette(ctx, variant = 'base', frame = 0) {
  const W = 48
  const H = 36
  const r = rng(7 + frame * 13)
  const p = (x, y, c, w = 1, h = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  ctx.clearRect(0, 0, W, H)

  // Cielo por franjas
  const skies = {
    base: ['#3d3a7a', '#6a4f9a', '#b06a8f', '#e79a7a'],
    fire: ['#3a0f0f', '#7a1d10', '#c2401a', '#ff8a2a'],
    gas: ['#1d2b22', '#2d4a33', '#4f7a43', '#9ec26a'],
    quake: ['#3a3430', '#5c524a', '#8a7a68', '#b9a58c'],
  }[variant]
  skies.forEach((c, i) => p(0, i * 5, c, W, 5))

  const shake = variant === 'quake' ? (frame % 2 ? 1 : -1) : 0

  // Edificio (fachada de ladrillo con arcos)
  p(6 + shake, 12, '#8a3f22', 36, 14)
  p(6 + shake, 11, '#d9c7a6', 36, 1)
  for (let x = 8; x < 40; x += 4) {
    p(x + shake, 14, variant === 'fire' && r() > 0.5 ? '#ffb347' : '#ffd877', 2, 3)
    p(x + shake, 20, '#2b2238', 2, 4)
    p(x + shake, 19, '#2b2238', 2, 1)
  }
  p(20 + shake, 18, '#1a1220', 8, 8) // entrada
  // Torre central
  p(21 + shake, 6, '#a24d2a', 6, 6)
  p(21 + shake, 5, '#d9c7a6', 6, 1)

  // Plazoleta circular
  p(4, 27, '#6e3229', 40, 9)
  p(10, 29, '#b2513e', 28, 4)
  p(18, 30, '#e0b25a', 12, 2)

  // Palmas
  ;[2, 44].forEach((x) => {
    p(x, 14, '#6b4a2b', 1, 13)
    p(x - 2, 12, '#3f8f3a', 5, 1)
    p(x - 3, 13, '#2f6f2b', 2, 1)
    p(x + 2, 13, '#2f6f2b', 2, 1)
  })

  if (variant === 'fire') {
    for (let i = 0; i < 40; i++) {
      const x = 6 + Math.floor(r() * 36)
      const y = 6 + Math.floor(r() * 10)
      p(x, y, ['#ffdd55', '#ff8a2a', '#e8401c'][i % 3])
    }
    for (let i = 0; i < 30; i++) p(Math.floor(r() * W), Math.floor(r() * 8), 'rgba(30,20,20,.75)', 2, 2)
  }
  if (variant === 'gas') {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor((r() * W + frame) % W)
      const y = 14 + Math.floor(r() * 18)
      p(x, y, 'rgba(150,255,120,.45)', 3, 2)
    }
  }
  if (variant === 'quake') {
    const crack = [
      [14, 12],
      [15, 13],
      [15, 14],
      [16, 15],
      [15, 16],
      [16, 17],
      [33, 12],
      [32, 13],
      [33, 14],
      [32, 15],
      [31, 16],
    ]
    crack.forEach(([x, y]) => p(x + shake, y, '#1a1220'))
    for (let i = 0; i < 10; i++) p(Math.floor(r() * W), 4 + Math.floor(r() * 26), '#c9b79c', 1, 1)
  }
}

/**
 * Viñeta con la foto real del campus (ver campusSnapshot.js) y la emergencia dibujada encima.
 * photo: canvas cuadrado; variant: 'base' | 'quake' | 'fire' | 'gas'; frame anima llamas/humo/gas.
 * Los efectos van en bloques de 2 px para que se lean igual de "pixel" que la foto.
 */
export function drawUaoVignette(ctx, photo, variant = 'base', frame = 0) {
  const S = photo.width
  const r = rng(11 + frame * 17)
  const u = S / 96 // las posiciones están pensadas para 96 px (techo ≈ 39, base de la fachada ≈ 78)
  const p = (x, y, c, w = 2, h = 2) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x * u), Math.round(y * u), Math.ceil(w * u), Math.ceil(h * u))
  }
  const shake =
    variant === 'quake'
      ? [
          [-2, 0],
          [2, 1],
          [-1, -1],
          [1, 0],
        ][frame % 4]
      : [0, 0]
  ctx.clearRect(0, 0, S, S)
  ctx.globalCompositeOperation = 'source-over'
  if (variant === 'quake') {
    ctx.fillStyle = '#5c524a' // lo que queda a la vista al sacudirse la foto
    ctx.fillRect(0, 0, S, S)
  }
  ctx.drawImage(photo, shake[0] * u, shake[1] * u)
  if (variant === 'base') return

  // Tinte de la emergencia sobre toda la foto
  const tint = { fire: 'rgb(255 120 60 / .9)', gas: 'rgb(150 230 120 / .85)', quake: 'rgb(210 180 140 / .9)' }[variant]
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, S, S)
  ctx.globalCompositeOperation = 'source-over'

  if (variant === 'fire') {
    // Ventanas encendidas
    for (let i = 0; i < 18; i++) p(8 + r() * 80, 44 + r() * 22, r() > 0.5 ? '#ffb347' : '#ffdd55')
    // Humo que sube desde el fuego, por delante de la fachada, hasta el cielo
    for (let i = 0; i < 40; i++) {
      const x = 4 + r() * 88
      const y = (70 - ((r() * 70 + frame * 3) % 70)) | 0
      p(x, y, `rgb(${(40 + r() * 30) | 0} 28 28 / ${0.3 + r() * 0.4})`, 4, 4)
    }
    // Llamas que salen del piso, frente al edificio: lenguas de distinta altura (amarillo abajo, rojo en la punta)
    for (let x = 0; x < 96; x += 2) {
      const wave = Math.max(0, Math.sin(x * 0.19 + frame * 0.9) + Math.sin(x * 0.07 - frame * 0.4))
      const h = Math.floor(4 + wave * 9 + r() * 6) * 2
      for (let k = 0; k < h; k += 2) p(x, 92 - k, k < h * 0.4 ? '#ffdd55' : k < h * 0.75 ? '#ff8a2a' : '#e8401c')
    }
  }

  if (variant === 'gas') {
    // Nubes de gas que se desplazan por el campus
    for (let i = 0; i < 26; i++) {
      const x = ((r() * 120 + frame * 2) % 120) - 12
      const y = 46 + r() * 46
      p(x, y, `rgb(150 255 120 / ${0.25 + r() * 0.3})`, 8, 4)
    }
    for (let i = 0; i < 14; i++) p(r() * 96, 30 + r() * 60, 'rgb(200 255 170 / .6)')
  }

  if (variant === 'quake') {
    // Grietas en la fachada
    const cracks = [
      [22, 44, [0, 1, 1, 0, -1, 0, 1]],
      [72, 44, [0, -1, 0, 1, 1, 0, -1]],
    ]
    cracks.forEach(([x0, y0, steps]) => {
      let x = x0
      steps.forEach((dx, k) => {
        x += dx * 2
        p(x + shake[0], y0 + shake[1] + k * 3, '#1a1220', 2, 3)
      })
    })
    // Escombros cayendo y polvo en el suelo
    for (let i = 0; i < 16; i++) p(6 + r() * 84, (38 + ((r() * 40 + frame * 4) % 40)) | 0, '#8a7a68')
    for (let i = 0; i < 20; i++) p(r() * 96, 80 + r() * 14, `rgb(201 183 156 / ${0.4 + r() * 0.4})`, 6, 3)
  }
}

/* ------------------------------------------------------------------ */
/* Pin del mapa (pixel art 2D, 13x19) — basado en el diseño entregado   */
/* ------------------------------------------------------------------ */

export const PIN_PALETTE = {
  k: '#2a1418', // contorno vino oscuro
  r: '#e3263a', // rojo UAO aclarado (se lee sobre el pasto)
  d: '#a50f25', // sombra lateral
  h: '#ff8a96', // brillo
}

export const PIN_SPRITE = [
  '...kkkkkkk...',
  '..krrrrrrdk..',
  '.krhrrrrrrdk.',
  'khrrrkkkrrrdk',
  'khrrk...krrdk',
  'khrk.....krdk',
  'krrk.....krdk',
  'krrrk...krrdk',
  'krrrrkkkrrrdk',
  'krrrrrrrrrrdk',
  '.krrrrrrrrdk.',
  '.krrrrrrrrdk.',
  '..krrrrrrdk..',
  '..krrrrrrdk..',
  '...krrrrdk...',
  '...krrrrdk...',
  '....krrdk....',
  '.....kdk.....',
  '......k......',
]
