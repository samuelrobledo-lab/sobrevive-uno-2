import sheet1 from '../assets/characters/personaje-1.png'
import sheet2 from '../assets/characters/personaje-2.png'
import sheet3 from '../assets/characters/personaje-3.png'

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
  { id: 'p1', name: 'Personaje 1', sheet: sheet1, frameW: 29, frameH: 25 },
  { id: 'p2', name: 'Personaje 2', sheet: sheet2, frameW: 30, frameH: 25 },
  { id: 'p3', name: 'Personaje 3', sheet: sheet3, frameW: 32, frameH: 26 },
]

export const FRAME_COUNT = 7

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
