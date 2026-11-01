/**
 * Ventanas en la fachada lisa (lado contrario a las columnas) de los 4 edificios largos.
 * 3 pisos × 4 ventanas por fachada, mismo estilo que el Edificio Principal.
 * Coordenadas de escena medidas sobre el FBX: plano exterior de cada fachada (mira hacia -Z).
 */
const FACADES = [
  { z: 10.42, x: [-0.84, 12.36] }, // Cube
  { z: 2.28, x: [8.41, 21.6] }, // Cube048
  { z: -6.72, x: [17.17, 30.37] }, // Cube049
  { z: -14.98, x: [25.94, 37.15] }, // Cube074
]
const FLOORS = [
  { y: 1.25, h: 1.2 },
  { y: 3.6, h: 1.2 },
  { y: 6.5, h: 1.0 }, // por encima de la franja saliente del último edificio (y 5.29–5.78)
]
const PER_FLOOR = 4

/** Ventanas de los edificios largos como datos para CampusWindows. */
export const LONG_BUILDING_WINDOWS = FACADES.flatMap(({ z, x: [x0, x1] }) => {
  const step = (x1 - x0) / PER_FLOOR
  return FLOORS.flatMap(({ y, h }) =>
    Array.from({ length: PER_FLOOR }, (_, i) => ({ position: [x0 + step * (i + 0.5), y, z - 0.03], rotationY: Math.PI, w: step - 0.6, h })),
  )
})
