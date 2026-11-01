import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import concreteUrl from '../../assets/textures/concreto.png'
import { pixelateTexture, usePixelTexture } from '../../utils/pixelTextures'

/**
 * Detalles del patio interior del Edificio Principal (bajo el techo en arco), según el boceto del equipo
 * (se repiten en el lado trasero del arco, salvo el seto):
 *  - moldura beige alrededor del arco del muro del fondo
 *  - ventanas (marco beige + vidrios aguamarina) en el muro del fondo y en los 3 pisos de cada ala,
 *    tanto hacia el patio como en las fachadas exteriores
 *  - franja de concreto gris que rodea cada ala por la cornisa media
 *  - seto sobre el borde frontal del patio, con algunas ramas que cuelgan
 *
 * Coordenadas de escena medidas sobre el FBX (ver UaoCampus):
 *   muro del fondo x = -16.63 · ala norte z = 5.12 · ala sur z = -5.46 · piso del patio y = 2.89
 */

const BEIGE = '#e6d7b6'

const BACK_X = -16.63
const REAR_X = -21.48 // cara trasera del bloque central (el otro lado del arco)
const REAR_FROM = -27.3 // tramo trasero entre las alas
const REAR_MID = (REAR_FROM + REAR_X) / 2
const NORTH_Z = 5.12
const SOUTH_Z = -5.46
const NORTH_OUT_Z = 11.2 // fachada exterior del ala norte (lado contrario al patio)
const SOUTH_OUT_Z = -11.54 // fachada exterior del ala sur
const OUTER_X = [-24.4, -18.25, -12.1] // 3 ventanas por fila a lo largo de la fachada exterior
const FLOOR_Y = 2.89
const X_FROM = -16.6 // tramo visible de las alas dentro del patio
const X_TO = -8.8
const X_MID = (X_FROM + X_TO) / 2

/** Cornisa media de cada ala (rodea todo el bloque); un poco más grande que la del FBX para cubrirla. */
const BALCONY_RINGS = [
  { x: [-27.85, -8.7], z: [4.62, 11.66] }, // ala norte
  { x: [-27.85, -8.7], z: [-12.04, -5.02] }, // ala sur
]

/** Arco del muro del fondo (círculo ajustado a la geometría del FBX). */
const ARCH = { z: 0.03, y: 2.31, r: 3.47, band: 0.4 }

/** Filas de ventanas de un ala: piso alto, medio y bajo (entre las cornisas del modelo). */
const WING_ROWS = [
  { y: 8.9, h: 0.9 },
  { y: 6.55, h: 1.0 },
  { y: 3.85, h: 1.4 },
]

/** Ventanas del Edificio Principal (patio, lado trasero y fachadas exteriores) como datos para CampusWindows. */
const win = (position, rotationY, w, h) => ({ position, rotationY, w, h })
export const COURTYARD_WINDOWS = [
  win([BACK_X + 0.03, 8.4, 0], Math.PI / 2, 6, 1.8), // ventanal sobre el arco
  win([REAR_X - 0.03, 8.4, 0], -Math.PI / 2, 6, 1.8), // ventanal del lado trasero
  ...WING_ROWS.flatMap(({ y, h }) => [
    win([REAR_MID, y, NORTH_Z - 0.03], Math.PI, 4.4, h),
    win([REAR_MID, y, SOUTH_Z + 0.03], 0, 4.4, h),
    win([X_MID, y, NORTH_Z - 0.03], Math.PI, 5.6, h),
    win([X_MID, y, SOUTH_Z + 0.03], 0, 5.6, h),
    ...OUTER_X.flatMap((x) => [win([x, y, NORTH_OUT_Z + 0.03], 0, 5.2, h), win([x, y, SOUTH_OUT_Z - 0.03], Math.PI, 5.2, h)]),
  ]),
]

export default function CourtyardDetails() {
  const concrete = useTexture(concreteUrl)
  const concreteMap = useMemo(() => {
    const t = pixelateTexture(concrete.clone())
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4, 1)
    return t
  }, [concrete])
  const leaves = usePixelTexture('leaves', 12, 1)
  const drape = usePixelTexture('leavesDrape')
  const archStart = Math.asin((FLOOR_Y - ARCH.y) / ARCH.r)

  return (
    <group>
      {/* Moldura del arco */}
      <mesh position={[BACK_X + 0.03, ARCH.y, ARCH.z]} rotation-y={Math.PI / 2}>
        <ringGeometry args={[ARCH.r, ARCH.r + ARCH.band, 40, 1, archStart, Math.PI - archStart * 2]} />
        <meshLambertMaterial color={BEIGE} side={THREE.DoubleSide} />
      </mesh>


      {/* Lado trasero (mismo tratamiento): moldura del arco */}
      <mesh position={[REAR_X - 0.03, ARCH.y, ARCH.z]} rotation-y={-Math.PI / 2}>
        <ringGeometry args={[ARCH.r, ARCH.r + ARCH.band, 40, 1, archStart, Math.PI - archStart * 2]} />
        <meshLambertMaterial color={BEIGE} side={THREE.DoubleSide} />
      </mesh>


      {/* Franja de concreto gris que da la vuelta completa a cada ala (cornisa media, y 7.2–8.3) */}
      {BALCONY_RINGS.map(({ x, z }) => (
        <mesh key={z[0]} position={[(x[0] + x[1]) / 2, 7.75, (z[0] + z[1]) / 2]}>
          <boxGeometry args={[x[1] - x[0], 1.16, z[1] - z[0]]} />
          <meshLambertMaterial map={concreteMap} />
        </mesh>
      ))}

      {/* Seto sobre el borde frontal del patio */}
      <mesh position={[-9.33, 3.13 + 0.28, -0.15]}>
        <boxGeometry args={[0.62, 0.56, 9.1]} />
        <meshLambertMaterial map={leaves} />
      </mesh>
      {/* Algunas ramas que caen un poquito por el frente */}
      {[
        [-3.6, 0.55],
        [-1.4, 0.4],
        [0.9, 0.6],
        [2.7, 0.45],
        [4.0, 0.35],
      ].map(([z, len]) => (
        <mesh key={z} position={[-8.98, 3.13 + 0.05 - len / 2, z]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.7, len]} />
          <meshLambertMaterial map={drape} transparent alphaTest={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
