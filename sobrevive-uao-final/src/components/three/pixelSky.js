import * as THREE from 'three'

/**
 * Cielo pixel art pintado en un canvas pequeño y usado como fondo de la escena (fijo en pantalla).
 * Así el sol se queda siempre atrás, en el mismo lugar, mientras la cámara se mueve.
 *
 * `day` (0–1) lleva del amanecer (morado → rosa → naranja → amarillo) a un día soleado
 * (azul claro arriba → celeste → toque amarillo en el horizonte); el sol sube y se aclara,
 * y las nubes pasan de rosadas a blancas.
 */

const SUNRISE = ['#3b4583', '#4d4f91', '#6a5a9c', '#8d6299', '#b46d91', '#d77f86', '#ec9479', '#f5ac6e', '#f9c477']
const DAY = ['#6fb2e4', '#7bbae7', '#88c2ea', '#97caec', '#a7d3ee', '#b9dbee', '#cde3ea', '#e2e9d8', '#f1ecc4']
const HORIZON = ['#fbd893', '#f6efc4']
export const HAZE = ['#e9b99a', '#dfe8dc'] // bruma (niebla) a juego con el horizonte

const SUN = [
  // [radio relativo, color amanecer, color día, opacidad]
  [1.3, '#fbe2a0', '#fff6c8', 0.55],
  [1, '#fbe2a0', '#fff1b0', 1],
  [0.73, '#fde9b0', '#fff6cc', 1],
  [0.53, '#fff2c6', '#fffbe6', 1],
  [0.4, '#fff8de', '#ffffff', 1],
]

const CLOUD = ['....pppp......', '..ppPPPPpp....', '.pPPPPPPPPpppp', 'pPPPPPPPPPPPPp', '.ssssssssssss.']
const CLOUD_COLORS = { p: ['#e8aab8', '#eef6fa'], P: ['#f2bfc4', '#ffffff'], s: ['#c98aa0', '#d3e3ec'] }
// [x (0–1), y (0–1), ancho (0–1)] en pantalla
const CLOUDS = [
  [0.13, 0.2, 0.17],
  [0.8, 0.11, 0.21],
  [0.46, 0.05, 0.12],
  [0.92, 0.33, 0.12],
  [0.27, 0.38, 0.1],
]

const W = 192 // ancho del canvas: cada píxel del cielo es grande, como en el resto del pixel art
const tmpA = new THREE.Color()
const tmpB = new THREE.Color()
export const mixHex = (a, b, t) => tmpA.set(a).lerp(tmpB.set(b), t).getStyle()

/** Generador pseudoaleatorio fijo (el tramado no "parpadea" al repintar). */
function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export class PixelSky {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.texture = null
    this.key = ''
  }

  /**
   * @param day     0 amanecer → 1 día
   * @param aspect  ancho / alto de la pantalla
   * @param sunRow  altura del sol al amanecer (0 arriba – 1 abajo)
   * @returns la textura (nueva si cambió el tamaño)
   */
  paint(day, aspect, sunRow) {
    const H = THREE.MathUtils.clamp(Math.round(W / aspect), 64, 420)
    const key = `${day.toFixed(3)}|${H}|${sunRow.toFixed(3)}`
    if (key === this.key) return this.texture
    this.key = key
    const c = this.canvas
    if (c.height !== H || !this.texture) {
      c.width = W
      c.height = H
      this.texture?.dispose()
      this.texture = new THREE.CanvasTexture(c)
      this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter
      this.texture.generateMipmaps = false
      this.texture.colorSpace = THREE.SRGBColorSpace
    }
    const g = c.getContext('2d')
    const r = rng(101)

    // 1. Degradado en franjas con tramado pixel en cada borde
    const bands = SUNRISE.map((col, i) => mixHex(col, DAY[i], day))
    const horizon = mixHex(HORIZON[0], HORIZON[1], day)
    g.fillStyle = horizon
    g.fillRect(0, 0, W, H)
    const end = Math.max(8, Math.round(THREE.MathUtils.lerp(sunRow, 0.9, day) * H))
    bands.forEach((col, i) => {
      const y0 = Math.round((i / bands.length) * end)
      const y1 = Math.round(((i + 1) / bands.length) * end)
      g.fillStyle = col
      g.fillRect(0, y0, W, y1 - y0)
      g.fillStyle = bands[i + 1] ?? horizon
      for (let x = 0; x < W; x += 2) if (r() > 0.4) g.fillRect(x + (y1 % 2), y1 - 1, 1, 1)
    })

    // 2. Sol: sube y se vuelve más blanco a medida que se hace de día
    const cx = Math.round(W / 2)
    const cy = Math.round(THREE.MathUtils.lerp(sunRow, 0.17, day) * H)
    const R = Math.max(5, H * THREE.MathUtils.lerp(0.075, 0.06, day))
    SUN.forEach(([k, a, b, alpha]) => {
      const rad = Math.round(R * k)
      g.globalAlpha = alpha
      g.fillStyle = mixHex(a, b, day)
      for (let y = -rad; y <= rad; y++) {
        const half = Math.floor(Math.sqrt(rad * rad - y * y))
        g.fillRect(cx - half, cy + y, half * 2 + 1, 1)
      }
    })
    g.globalAlpha = 1

    // 3. Nubes pixel (rosadas al amanecer, blancas de día)
    const colors = Object.fromEntries(Object.entries(CLOUD_COLORS).map(([k, [a, b]]) => [k, mixHex(a, b, day)]))
    CLOUDS.forEach(([fx, fy, fw]) => {
      const s = Math.max(1, Math.round((fw * W) / CLOUD[0].length))
      const x0 = Math.round(fx * W - (CLOUD[0].length * s) / 2)
      const y0 = Math.round(fy * H)
      CLOUD.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.') return
          g.fillStyle = colors[ch]
          g.fillRect(x0 + x * s, y0 + y * s, s, s)
        }),
      )
    })

    this.texture.needsUpdate = true
    return this.texture
  }
}
