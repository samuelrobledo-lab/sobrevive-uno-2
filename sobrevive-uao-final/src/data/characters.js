import sheet1 from '../assets/characters/personaje-1.png'
import sheet2 from '../assets/characters/personaje-2.png'
import sheet3 from '../assets/characters/personaje-3.png'
import squashedSheet from '../assets/characters/aplastado.png'
import burningSheet from '../assets/characters/quemado.png'

/**
 * Personajes jugables. Cada spritesheet es una tira horizontal de 7 fotogramas
 * extraídos del arte entregado (resolución pixel nativa, fondo transparente):
 *
 *   0-3 → caminar (loop; los fotogramas 1 y 3 van 1 píxel más arriba = "saltadito")
 *   4-6 → saltar (preparación, en el aire, aterrizaje)
 *
 * Todos miran a la DERECHA; para caminar a la izquierda se espejan.
 * Para cambiar nombres basta con editar `name`.
 */
export const CHARACTERS = [
  { id: 'p1', name: 'Personaje 1', sheet: sheet1, frameW: 29, frameH: 25, squashed: 0, burning: 0 },
  { id: 'p2', name: 'Personaje 2', sheet: sheet2, frameW: 30, frameH: 25, squashed: 2, burning: 2 },
  { id: 'p3', name: 'Personaje 3', sheet: sheet3, frameW: 32, frameH: 26, squashed: 1, burning: 1 },
]

export const FRAME_COUNT = 7

/**
 * Personaje aplastado por un pedazo de techo (terremoto), del arte entregado: tira de 3 fotogramas de 42 × 22 px,
 * uno por personaje (`squashed` es su índice), con la sangre alrededor. Se dibuja plano sobre el piso.
 */
export const SQUASHED = { sheet: squashedSheet, frames: 3, frameW: 42, frameH: 22 }

/**
 * Personaje que se quema (fuego) o se ahoga (gas) al tocar el peligro, del arte entregado: 3 filas (una por
 * personaje, `burning` es su fila) × 3 fotogramas de 26 × 23 px (quieto, brazos arriba, quieto). Se anima en
 * loop rápido (0, 1, 2, 1) con un tinte encima (ver Avatar).
 */
export const BURNING = { sheet: burningSheet, frames: 3, rows: 3, frameW: 26, frameH: 23, loop: [0, 1, 2, 1], frameMs: 110 }

/** Secuencias de animación: [índice de fotograma, duración en ms]. */
export const ANIMATIONS = {
  idle: [[0, 1000]],
  walk: [
    [0, 140],
    [1, 140],
    [2, 140],
    [3, 140],
  ],
  // salto + pequeña pausa en el piso antes de repetir
  jump: [
    [4, 150],
    [5, 340],
    [6, 170],
    [0, 380],
  ],
  // pánico: caminar muy rápido
  panic: [
    [0, 60],
    [1, 60],
    [2, 60],
    [3, 60],
  ],
}

/** Fotograma que toca en el instante `ms` de una animación en loop. */
export function frameAt(anim, ms) {
  const seq = ANIMATIONS[anim]
  const total = seq.reduce((a, [, d]) => a + d, 0)
  let t = ms % total
  for (const [f, d] of seq) {
    if (t < d) return f
    t -= d
  }
  return seq[0][0]
}

export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]
