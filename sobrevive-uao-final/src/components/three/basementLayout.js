import * as THREE from 'three'

/**
 * Distribución de los sótanos (modelo src/assets/models/sotanos.fbx) para el movimiento libre del avatar.
 *
 * El modelo tiene dos niveles con la misma planta (corredor oeste, corredor este y dos pasillos que los
 * unen alrededor de un patio vacío). Del Sótano 2 al Sótano 1 se sube por la rampa del ala oeste o por
 * las dos escaleras del costado este (x ≈ 33–39; z ≈ −17.6…−12 y 5…10.3):
 *
 *   Sótano 2 (abajo, y = 0) ──▸ rampa (oeste) / escaleras (este) ▸── Sótano 1 (arriba, y ≈ 3)
 *
 * - START / CHECKPOINTS / SAFE_ZONE / SPOTS  posiciones de la historia (en unidades de escena)
 * - nav  pisos y muros calculados sobre el modelo (raycasts), lo registra <SotanosModel/>
 *
 * ⚠️ Posiciones provisionales: ajustarlas cuando se defina dónde ocurre cada momento de la historia.
 */

/** Conversión del FBX (unidades del modelo) a la escena. */
export const BASEMENT_SCALE = 0.002
export const BASEMENT_OFFSET = [-7488 * BASEMENT_SCALE, -1804 * BASEMENT_SCALE, -2783 * BASEMENT_SCALE]

/** Niveles de piso (y superior). */
export const LEVEL = { s2: 0, s1: (3322 - 1804) * BASEMENT_SCALE }

export const START = [-8.8, LEVEL.s2, 18] // Sótano 2, extremo sur del corredor oeste

export const CHECKPOINTS = [
  [-4, LEVEL.s2, -19.6], // Sótano 2: cruce junto al ascensor
  [-8.8, LEVEL.s1, -6], // Sótano 1: corredor oeste
  [27, LEVEL.s1, -19.6], // Sótano 1: llegada al corredor este
]
/** Distancia a la que un punto de control abre su pregunta. */
export const CHECKPOINT_RADIUS = 1.8

/** Punto de encuentro (provisional): extremo norte del corredor este, en el Sótano 1. */
export const SAFE_ZONE = { x: [26, 32], z: [29, 34], y: LEVEL.s1, center: [29, LEVEL.s1, 31.5] }
export const inSafeZone = (x, y, z) =>
  Math.abs(y - SAFE_ZONE.y) < 1 && x >= SAFE_ZONE.x[0] && x <= SAFE_ZONE.x[1] && z >= SAFE_ZONE.z[0] && z <= SAFE_ZONE.z[1]

/**
 * Lugares de la historia: a dónde corre el avatar al equivocarse (`failTarget`) y los puntos de las rutas
 * (`route` y `at` en emergencies.js). Medidos sobre el modelo.
 */
export const SPOTS = {
  elevatorS2: [-1.2, LEVEL.s2, -21.6],
  switchS2: [-13.6, LEVEL.s2, -14],
  elevatorS1: [-1.2, LEVEL.s1, -21.6],
  exit: [29, LEVEL.s1, -14],
  backInside: [18, LEVEL.s1, -19.6],
  // Ruta del terremoto (boceto "Ruta terremoto Parte 1")
  corridorS2: [-19.5, LEVEL.s2, 21], // pasillo pequeño del ala suroeste (inicio)
  elevatorFrontNorthS2: [-1.4, LEVEL.s2, -19.5], // frente al ascensor norte, en el pasillo de cruce
  elevatorFrontSouthS2: [-1.6, LEVEL.s2, 12.1], // frente al ascensor sur, en el pasillo de cruce
  crossNorthEastS2: [26.6, LEVEL.s2, -19.5], // llegada del pasillo de cruce norte al corredor este
  crossSouthEastS2: [26.1, LEVEL.s2, 13], // llegada del pasillo de cruce sur al corredor este
  rampWingS2: [-13.7, LEVEL.s2, -31.6], // corredor oeste, entrada al pasillo de la rampa
  studyS2: [27.25, LEVEL.s2, -1.5], // silla de la mesa de estudio del corredor este (STUDY_TABLE en LabsTables): inicio de la fuga de gas
  outsideLabs: [43.5, LEVEL.s1, -3.5], // afuera de labs: frente al Edificio Principal, mirando a la plazoleta (ver OutsideLabs)
  meetingPoint: [50.8, LEVEL.s1, -3.5], // punto de encuentro: el centro de la plazoleta circular del campus
  // Ruta del incendio (boceto "Ruta Incendio Parte 1, Sótano 2")
  elevatorS2South: [-0.92, LEVEL.s2, 15.3], // ascensor sur del Sótano 2
  furnitureS2: [-5.6, LEVEL.s2, 7.2], // muebles del corredor oeste, junto al pasillo de cruce sur (inicio): al lado del puff rojo
  puffS2: [-3.97, LEVEL.s2 + 0.68, 7.2], // encima del puff rojo (ver SotanoDecor): ahí está acostado al empezar el incendio
  rampS2: [-31.6, LEVEL.s2, -23], // pie de la rampa (ala oeste)
  stairsNorthS2: [31.6, LEVEL.s2, -13.4], // pie de la escalera norte (costado este)
  stairsSouthS2: [31.6, LEVEL.s2, 6.6], // pie de la escalera sur (costado este)
  // Ruta del incendio, Sótano 1 (boceto "Ruta Incendio Parte 2")
  rampTopS1: [-12.7, LEVEL.s1, -22.3], // llegada de la rampa al Sótano 1
  stairsNorthTopS1: [30.5, LEVEL.s1, -15], // llegada de la escalera norte
  stairsSouthTopS1: [31.2, LEVEL.s1, 7.9], // llegada de la escalera sur
  tablesS1: [-9.1, LEVEL.s1, -2.6], // mesas de labs 1 (corredor oeste del Sótano 1)
  exitS1: [34.8, LEVEL.s1, -3.3], // frente a la salida de los sótanos (entre las dos escaleras)
}

/** Afuera de labs, el campus (UaoCampus) se pone con el centro de la plazoleta (su origen) en el punto de encuentro. */
export const OUTSIDE_OFFSET = SPOTS.meetingPoint

/** Inicio de la emergencia (su `route.start` o START). */
export const routeStart = (emergency) => SPOTS[emergency?.route?.start] ?? START

/**
 * Lugares donde se activa el paso actual: la pregunta `step` o, después de la última, la meta.
 * [] → la pregunta sale sin moverse (al despertar); null → la meta es SAFE_ZONE.
 */
export function stepSpots(emergency, step) {
  const decision = emergency.decisions[step]
  if (!decision) return emergency.route?.goal ? [SPOTS[emergency.route.goal]] : null
  if (decision.at === 'start') return []
  return decision.at ? decision.at.map((key) => SPOTS[key]) : [CHECKPOINTS[step]]
}

/** Pasos que pueden salir ahora: el actual y sus `variants` (otra pregunta en su lugar según a dónde llegue). */
export function stepTargets(emergency, step) {
  const variants = emergency.decisions[step]?.variants ?? []
  return [step, ...variants.map((id) => emergency.decisions.findIndex((d) => d.id === id))].map((index) => ({
    index,
    spots: stepSpots(emergency, index),
  }))
}

/** Si el avatar en (x, y, z) llegó a algún lugar del paso actual (o de una variante), devuelve ese paso; si no, -1. */
export function stepReached(emergency, step, x, y, z) {
  const near = ([sx, sy, sz]) => Math.abs(y - sy) < 1 && Math.hypot(x - sx, z - sz) < CHECKPOINT_RADIUS
  for (const { index, spots } of stepTargets(emergency, step)) if (spots ? spots.some(near) : inSafeZone(x, y, z)) return index
  return -1
}

/**
 * Incendio: fuego en los dos sótanos (bocetos "Ruta Incendio Parte 1 y 2"). Cada tramo [x0, z0, x1, z1] se
 * llena de llamas cada FIRE_STEP; tocarlas (a menos de FIRE_RADIUS, en el mismo piso) quema al personaje.
 */
const FIRE_LINES_S2 = [
  [-25.2, -33.2, -23, -33.2], // ala de la rampa, contra el muro norte (deja libre el paso)
  [-13.6, -29.5, -13.6, -25], // corredor oeste, al norte
  [4.8, -20.7, 10.3, -20.7], // pasillo de cruce norte
  [26.1, -25.3, 26.1, -20.7], // corredor este, al norte
  [31.1, -25.7, 31.1, -25.7],
  [-12.8, -8.9, -12.8, 1.9], // corredor oeste, contra el muro
  [30.7, -6.2, 30.7, -0.8], // corredor este, entre las escaleras
  [6.4, 11.4, 13.2, 11.4], // pasillo de cruce sur
  [-13.8, 16.5, -13.8, 18.5], // corredor oeste, junto al ala sur
  [30.7, 18.7, 30.7, 18.7],
  [-12.3, 25.6, -5.3, 25.6], // corredor oeste, al sur
  [27, 34, 27, 34], // corredor este, al sur
]
const FIRE_LINES_S1 = [
  [-5.6, -32, -5.6, -27.5], // corredor oeste, al norte
  [7.5, -20.4, 15.6, -20.4], // pasillo de cruce norte
  [24.4, -18.6, 24.4, -18.6], // llegada al corredor este
  [-4.5, -7.3, -4.5, -7.3], // junto al patio
  [-13.2, -5.1, -13.2, 2.5], // corredor oeste, contra el muro (cerca de las mesas)
  [-4.9, 11.5, -4.9, 11.5], // esquina del pasillo de cruce sur
  [7.2, 13.3, 11.5, 13.3], // pasillo de cruce sur
  [17.6, 11.1, 17.6, 11.1],
  [-14, 21.7, -14, 21.7], // corredor oeste, al sur
]
/** Fuga de gas: nubes de gas en los dos sótanos (bocetos "Ruta Fuga de gas Parte 1 y 2"); tocarlas ahoga. */
const GAS_LINES_S2 = [
  [-4.5, -32, -4.5, -25.9], // corredor oeste, al norte
  [-13.3, -25.7, -13.3, -18], // corredor oeste, contra el muro
  [9.9, -20.9, 15.8, -20.9], // pasillo de cruce norte
  [31.1, -27.6, 31.1, -21.5], // corredor este, al norte
  [38.5, -15, 38.5, -15], // descanso de la escalera norte
  [-5, -7.3, -5, 3], // corredor oeste, junto al patio
  [38.1, 8, 38.1, 8], // descanso de la escalera sur
  [1, 13, 7.2, 13], // pasillo de cruce sur
  [25.5, 12.2, 25.5, 20.3], // corredor este, al sur
  [-11.9, 17.6, -11.9, 22.9], // corredor oeste, junto al ala sur
  [30.7, 25.2, 30.7, 31], // corredor este, al final
]
const GAS_LINES_S1 = [
  [-4.9, -31.8, -4.9, -25], // corredor oeste, al norte
  [6.8, -20.8, 15.9, -20.8], // pasillo de cruce norte
  [26, -23.5, 26, -19.2], // llegada al corredor este
  [-4.9, -11.6, -4.9, 1.8], // corredor oeste, junto al patio
  [36.1, -8, 36.1, -8], // frente a la salida, al norte
  [33, 2.6, 33, 2.6], // frente a la salida, al sur
  [7.9, 11.5, 14.5, 11.5], // pasillo de cruce sur
  [-11.5, 25.5, -11.5, 25.5], // corredor oeste, al sur
  [27, 21.6, 27, 29.1], // corredor este, al sur
]

const FIRE_STEP = 1.3
export const FIRE_RADIUS = 0.75
const fireLine =
  (y) =>
  ([x0, z0, x1, z1]) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / FIRE_STEP) + 1)
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1)
      return [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t]
    })
  }
/** Zigzag de las zonas de fuego: cada ZIGZAG.period a lo largo del tramo, la línea se corre ±ZIGZAG.amp de lado. */
const ZIGZAG = { period: 2.2, amp: 0.9 }
/**
 * Llamas en zigzag a lo largo de un tramo (así esquivarlas es más difícil que una sola hilera): vértices que se
 * alternan a un lado y al otro, y llamas cada FIRE_STEP a lo largo del zigzag. Un tramo de un solo punto queda igual.
 */
const fireZigzag =
  (y) =>
  ([x0, z0, x1, z1]) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    if (len < 0.01) return [[x0, y, z0]]
    const [ux, uz] = [(x1 - x0) / len, (z1 - z0) / len]
    const n = Math.max(2, Math.round(len / ZIGZAG.period) + 1)
    const corners = Array.from({ length: n }, (_, i) => {
      const t = (i / (n - 1)) * len
      const side = (i % 2 ? 1 : -1) * ZIGZAG.amp
      return [x0 + ux * t - uz * side, z0 + uz * t + ux * side]
    })
    return corners.slice(1).flatMap(([bx, bz], i) => {
      const [ax, az] = corners[i]
      return fireLine(y)([ax, az, bx, bz]).slice(i ? 1 : 0)
    })
  }
/** Llamas de cada sótano: [x, y, z]. */
export const FIRES = { s2: FIRE_LINES_S2.flatMap(fireZigzag(LEVEL.s2)), s1: FIRE_LINES_S1.flatMap(fireZigzag(LEVEL.s1)) }
/** Nubes de gas de cada sótano: [x, y, z] (mismo paso y radio que las llamas). */
export const GAS = { s2: GAS_LINES_S2.flatMap(fireLine(LEVEL.s2)), s1: GAS_LINES_S1.flatMap(fireLine(LEVEL.s1)) }
/** Peligros que no se pueden tocar, por amenaza. */
const DEADLY = { fire: FIRES, gas: GAS }
/**
 * Terremoto: pedazos grandes de techo que están cayendo justo ahora (los registra <BigDebris/> en el instante
 * del impacto): [x, y, z, radio]. Si caen encima del avatar, muere.
 */
export const DEBRIS_HITS = []
/** ¿El avatar en (x, y, z) toca una llama (incendio), una nube de gas (fuga de gas) o un pedazo de techo (terremoto)? */
export const touchesHazard = (hazard, x, y, z) => {
  if (hazard === 'quake') return DEBRIS_HITS.some(([hx, hy, hz, r]) => Math.abs(y - hy) < 1 && Math.hypot(x - hx, z - hz) < r)
  const zones = DEADLY[hazard]
  if (!zones) return false
  return [...zones.s2, ...zones.s1].some(([fx, fy, fz]) => Math.abs(y - fy) < 1 && Math.hypot(x - fx, z - fz) < FIRE_RADIUS)
}

/* ------------------------------------------------------------------ */
/* Navegación sobre el modelo                                          */
/* ------------------------------------------------------------------ */
const R = 0.35 // radio del avatar
const STEP_UP = 0.45 // desnivel máximo que se puede subir/bajar de un paso (la rampa es suave)
const KNEE = 0.4 // altura del rayo que detecta muros

const ray = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)
const from = new THREE.Vector3()
const dir = new THREE.Vector3()

export const nav = {
  floors: [], // todas las mallas (cualquier superficie bajo los pies sirve de piso)
  walls: [], // muros: bloquean el paso a la altura de la rodilla
  blockers: [], // muebles (cajas invisibles): también bloquean el paso, sin ser parte del modelo

  /** Altura del piso bajo (x, z) en el nivel del avatar (busca hacia abajo desde un poco sobre sus pies). */
  floorAt(x, y, z) {
    if (!this.floors.length) return null
    from.set(x, y + 0.6, z)
    ray.set(from, DOWN)
    ray.far = 1.6
    const hit = ray.intersectObjects(this.floors, false)[0]
    return hit ? hit.point.y : null
  },

  /** Intenta mover de (x, y, z) a (nx, nz): devuelve la nueva altura o null si no se puede. */
  move(x, y, z, nx, nz) {
    const fy = this.floorAt(nx, y, nz)
    if (fy === null || Math.abs(fy - y) > STEP_UP) return null
    dir.set(nx - x, 0, nz - z)
    const len = dir.length()
    if (len > 0) {
      ray.set(from.set(x, y + KNEE, z), dir.divideScalar(len))
      ray.far = len + R
      if (ray.intersectObjects(this.walls, false).length || ray.intersectObjects(this.blockers, false).length) return null
    }
    return fy
  },
}
