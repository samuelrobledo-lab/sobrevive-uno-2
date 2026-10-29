/**
 * Elementos del suelo del campus (caminos, lago, rocas, vegetación).
 *
 * Las coordenadas vienen del boceto entregado (vista cenital del mapa, en píxeles de esa imagen)
 * y se convierten a coordenadas de escena con `fromSketch`, calibrado con los edificios:
 *   plazoleta ≈ (1030, 810) px  ·  1 unidad de escena ≈ 18.75 px en X y 19.5 px en Y.
 * En el boceto el edificio principal queda a la derecha, por eso el eje X va invertido.
 *
 * Para mover algo, basta con editar los puntos en píxeles del boceto.
 */

export const fromSketch = ([px, py]) => [0.2 - (px - 1030) / 18.75, 0.06 - (py - 810) / 19.5]
const pts = (list) => list.map(fromSketch)

/** Caminos: polilíneas (ancho en unidades de escena). */
export const PATHS = [
  // Anillo alrededor del edificio largo superior
  { width: 1.1, points: pts([[522, 555], [580, 468], [1060, 470], [1115, 505], [1112, 592], [1078, 636], [505, 640], [505, 555], [522, 555]]) },
  { width: 1.1, points: pts([[240, 558], [505, 556]]) },
  { width: 1.1, points: pts([[245, 558], [245, 650], [505, 650]]) },
  { width: 1.0, points: pts([[985, 470], [985, 520]]) },
  // Red entre los edificios largos
  { width: 1.1, points: pts([[330, 800], [920, 800]]) },
  { width: 1.1, points: pts([[330, 800], [330, 1030]]) },
  { width: 1.1, points: pts([[330, 985], [810, 985]]) },
  { width: 1.0, points: pts([[495, 800], [495, 845]]) },
  { width: 1.0, points: pts([[625, 810], [625, 860]]) },
  { width: 1.0, points: pts([[635, 945], [635, 985]]) },
  { width: 1.0, points: pts([[455, 990], [455, 1035]]) },
  { width: 1.0, points: pts([[450, 1120], [450, 1165]]) },
  { width: 1.0, points: pts([[815, 770], [815, 800]]) },
  { width: 1.1, points: pts([[450, 1162], [715, 1165]]) },
  // Diagonales hacia la plazoleta
  { width: 1.2, points: pts([[1010, 612], [715, 1165]]) },
  { width: 1.1, points: pts([[985, 655], [860, 905]]) },
  // Conexiones con el edificio principal
  { width: 1.1, points: pts([[965, 705], [1110, 712]]) },
  { width: 1.1, points: pts([[860, 905], [1110, 912]]) },
]

/** Áreas de camino (polígonos rellenos). */
export const PATH_AREAS = [
  pts([[1030, 758], [1205, 758], [1205, 870], [1030, 870]]), // plazoleta → edificio principal
  pts([[310, 640], [505, 640], [505, 800], [345, 800], [265, 880], [238, 860], [395, 700], [310, 700]]), // explanada con flecha
]

/** Camino circular de la plazoleta. */
export const PATH_RINGS = [{ center: fromSketch([1030, 812]), radius: 62 / 19, width: 1.2 }]

/** Lago (elipse). */
export const LAKES = [{ center: fromSketch([660, 555]), rx: 32 / 18.75, rz: 47 / 19.5 }]

/** Rocas junto al lago. */
export const ROCKS = pts([[686, 478], [690, 500], [695, 520], [700, 540], [703, 560], [705, 580], [700, 600], [690, 620]])

/** Plantas y árboles: se reparten a lo largo de cada trazo. */
export const PLANTINGS = [
  pts([[530, 500], [570, 435], [735, 432]]),
  pts([[605, 500], [598, 550], [605, 615]]),
  pts([[735, 497], [780, 497]]),
  pts([[722, 520], [715, 590], [740, 620], [980, 620]]),
  pts([[555, 785], [805, 785]]),
  pts([[870, 668], [905, 690]]),
  pts([[385, 965], [615, 965]]),
  pts([[760, 830], [740, 860], [760, 900], [800, 915]]),
  pts([[285, 1138], [430, 1138]]),
  pts([[475, 1130], [545, 1130]]),
  pts([[575, 1112], [592, 1102]]),
  pts([[625, 1010], [600, 1050], [625, 1090]]),
]

/**
 * Fuentes en medio círculo junto a los edificios largos (piezas Cylinder037-045 del FBX):
 * centro en coordenadas de escena y radio del anillo de rocas que las rodea.
 */
const FOUNTAINS = [
  { center: [13.45, -2.56], radius: 2.5 },
  { center: [20.27, -12.0], radius: 2.5 },
  { center: [5.13, 6.8], radius: 2.5 },
]

/* ---------- ¿Un punto cae sobre un camino? ---------- */
const distToSegment = ([px, pz], [ax, az], [bx, bz]) => {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}
const insidePolygon = ([px, pz], poly) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
/** true si el punto está sobre (o a menos de `margin` de) un camino, explanada o anillo. */
export function isOnPath(p, margin = 0.5) {
  if (PATHS.some(({ width, points }) => points.some((a, i) => i > 0 && distToSegment(p, points[i - 1], a) < width / 2 + margin))) return true
  if (PATH_AREAS.some((poly) => insidePolygon(p, poly))) return true
  return PATH_RINGS.some(({ center, radius, width }) => Math.abs(Math.hypot(p[0] - center[0], p[1] - center[1]) - radius) < width / 2 + margin)
}

/** Anillos de rocas alrededor de cada fuente; se omiten las que caerían sobre un camino. */
export const FOUNTAIN_ROCKS = FOUNTAINS.flatMap(({ center: [cx, cz], radius }, f) =>
  Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + f * 0.4 + Math.sin(i * 7.3) * 0.12
    const r = radius + Math.sin(i * 3.1 + f) * 0.25
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
  }),
).filter((p) => !isOnPath(p))

/**
 * Hileras de árboles y arbustos a ambos lados largos del Edificio Principal
 * (coordenadas de escena; la plataforma va de x -9.2 hasta el corte en PLATFORM_CUT_X).
 */
export const MAIN_BUILDING_PLANTINGS = [
  [[-9.6, 13.3], [-10.6, 12.6], [-35.5, 12.6]], // lado norte
  [[-9.6, -13.5], [-10.6, -12.8], [-35.5, -12.8]], // lado sur
]

/** Ágora: pequeña depresión circular con gradas, en la plazoleta. */
export const AGORAS = [{ center: fromSketch([1030, 812]), radius: 2.3, steps: 4 }]

/** Corte de la plataforma del Edificio Principal (x de escena): se elimina lo que queda más allá. */
export const PLATFORM_CUT_X = -36.5
