import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makePixelTexture } from '../../utils/pixelTextures'
import { LEVEL } from './basementLayout'

/**
 * Elementos fijos de los sótanos (según las fotos del equipo):
 *
 *  - Ascensores en los dos nichos junto a los pasillos de cruce, en los dos pisos: fondo gris pardo, puertas
 *    de acero inoxidable con marco, botonera y pantalla, y letrero amarillo "Ascensor" afuera del nicho.
 *  - Salida de los sótanos (Sótano 1, costado este, entre las dos escaleras): fachada de vidrio con marcos
 *    verdes, dos puertas dobles y ventanales con vista al jardín.
 *  - Pasamanos de bronce sobre los muretes de ladrillo de las dos escaleras.
 *
 * Todo usa los mismos cortes horizontales del modelo (cada piso solo se ve cuando el personaje está en él).
 */

const Y = LEVEL.s1

/**
 * Ascensores: centro x del nicho, z del fondo, z de la boca (pared del pasillo) y hacia dónde mira la puerta.
 * Medidas tomadas del modelo (nichos de 1.9 de ancho y 2.6 de fondo).
 */
const ELEVATORS = [LEVEL.s1, LEVEL.s2].flatMap((y) => [
  { y, x: -0.92, backZ: -24.15, mouthZ: -21.59, facing: 1 }, // junto al pasillo de cruce norte
  { y, x: -0.92, backZ: 17.02, mouthZ: 14.56, facing: -1 }, // junto al pasillo de cruce sur
])
const NICHE_W = 1.89
const WALL_H = 1.87 // altura de los muros del Sótano 1 en el modelo

/** Fachada de la salida: cara interior del muro este y tramo entre las dos escaleras (medidos en el modelo). */
const FACADE = { x: 38.9, z: [-11.35, 4.25] }
/** Secuencia de la fachada a lo largo de z: ventanal (W) o puerta doble (D) con su ancho. */
const FACADE_ITEMS = [
  ['W', 2.4],
  ['D', 1.8],
  ['W', 2.4],
  ['W', 2.4],
  ['W', 2.4],
  ['D', 1.8],
  ['W', 2.4],
]
/** Muretes de las escaleras (entre cada escalera y la salida): z del centro, tramo en x y altura de su borde. */
const PARAPETS = [
  { z: -11.65, x: [33.6, 38.85], top: LEVEL.s1 + 1.04 },
  { z: 4.6, x: [33.6, 38.85], top: LEVEL.s1 + 1.04 },
]

const COLORS = {
  backWall: '#7a7266', // gris pardo del fondo del ascensor
  frame: '#c9ccd0',
  panel: '#d5d7da',
  screen: '#11161c',
  facadeFrame: '#2f4b3b', // marcos verdes de la salida
  facadeSign: '#1f8a4c',
  rail: '#5b4631', // pasamanos de bronce oscuro
}

/** Geometrías unidas (marcos, vidrio, letreros) de la fachada de la salida, ya en coordenadas de escena. */
function buildFacade() {
  const parts = { frame: [], glass: [], sign: [] }
  const place = (geo, z, y, list) =>
    list.push(
      geo
        .translate(0, y, 0)
        .rotateY(-Math.PI / 2)
        .translate(FACADE.x, Y, z),
    )
  const bar = (w, h, z, y) => place(new THREE.BoxGeometry(w, h, 0.07), z, y, parts.frame)
  let z = FACADE.z[0]
  FACADE_ITEMS.forEach(([kind, w]) => {
    const zc = z + w / 2
    if (kind === 'W') {
      // ventanal: antepecho de ladrillo abajo (el muro), vidrio en dos paños con parteluz
      place(new THREE.PlaneGeometry(w - 0.1, 1.3), zc, 1.05, parts.glass)
      bar(w, 0.07, zc, 0.4)
      bar(w, 0.07, zc, 1.7)
      bar(0.06, 1.3, zc, 1.05)
    } else {
      // puerta doble de vidrio con su letrero verde encima
      place(new THREE.PlaneGeometry(w - 0.1, 1.5), zc, 0.77, parts.glass)
      bar(w, 0.07, zc, 1.55)
      bar(0.06, 1.5, zc, 0.77) // unión de las hojas
      bar(w - 0.2, 0.04, zc, 0.95) // barras de empuje
      place(new THREE.BoxGeometry(w * 0.6, 0.18, 0.04), zc, 1.72, parts.sign)
    }
    bar(0.08, 1.75, z + 0.04, 0.875) // montante entre paños
    z += w
  })
  bar(0.08, 1.75, z - 0.04, 0.875)
  return Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, mergeGeometries(list)]))
}

/** Pasamanos con parales sobre los muretes de las escaleras (una geometría para todos). */
function buildRails() {
  const geos = []
  PARAPETS.forEach(({ z, x: [x0, x1], top }) => {
    geos.push(new THREE.BoxGeometry(x1 - x0, 0.06, 0.07).translate((x0 + x1) / 2, top + 0.42, z))
    for (let x = x0 + 0.15; x < x1; x += 0.8) geos.push(new THREE.BoxGeometry(0.05, 0.42, 0.05).translate(x, top + 0.2, z))
  })
  return mergeGeometries(geos)
}

/** Un ascensor dentro de su nicho (grupo local: +z apunta hacia el pasillo). */
function Elevator({ x, y, backZ, mouthZ, facing, clippingPlanes, steel, sign }) {
  const mat = (props) => ({ clippingPlanes, ...props })
  return (
    <group>
      <group position={[x, y, backZ]} rotation-y={facing > 0 ? 0 : Math.PI}>
        {/* Fondo gris pardo */}
        <mesh position={[0, WALL_H / 2, 0.012]}>
          <planeGeometry args={[NICHE_W, WALL_H]} />
          <meshLambertMaterial {...mat({ color: COLORS.backWall })} />
        </mesh>
        {/* Marco y puertas de acero */}
        <mesh position={[0, 0.83, 0.03]}>
          <boxGeometry args={[1.08, 1.66, 0.03]} />
          <meshLambertMaterial {...mat({ color: COLORS.frame })} />
        </mesh>
        <mesh position={[0, 0.78, 0.05]}>
          <planeGeometry args={[0.96, 1.56]} />
          <meshLambertMaterial {...mat({ map: steel })} />
        </mesh>
        {/* Pantalla y botonera */}
        <mesh position={[0.7, 1.32, 0.03]}>
          <boxGeometry args={[0.1, 0.15, 0.02]} />
          <meshBasicMaterial {...mat({ color: COLORS.screen })} />
        </mesh>
        <mesh position={[0.7, 1.34, 0.042]}>
          <planeGeometry args={[0.04, 0.06]} />
          <meshBasicMaterial {...mat({ color: '#5fb6ff', toneMapped: false })} />
        </mesh>
        <mesh position={[0.7, 1.0, 0.03]}>
          <boxGeometry args={[0.09, 0.17, 0.02]} />
          <meshLambertMaterial {...mat({ color: COLORS.panel })} />
        </mesh>
      </group>
      {/* Letrero "Ascensor" en la pared del pasillo, a la izquierda de la boca del nicho */}
      <mesh
        position={[x - facing * (NICHE_W / 2 + 0.32), y + 1.45, mouthZ + facing * 0.015]}
        rotation-y={facing > 0 ? 0 : Math.PI}
      >
        <planeGeometry args={[0.34, 0.34]} />
        <meshLambertMaterial {...mat({ map: sign })} />
      </mesh>
    </group>
  )
}

export default function SotanosFurniture({ clippingPlanes }) {
  const { steel, sign, facade, rails, outside } = useMemo(
    () => ({
      steel: makePixelTexture('steelDoor'),
      sign: makePixelTexture('elevatorSign'),
      facade: buildFacade(),
      rails: buildRails(),
      outside: makePixelTexture('outsideView', 2, 1),
    }),
    [],
  )

  return (
    <group>
      {ELEVATORS.map((e) => (
        <Elevator key={`${e.y}|${e.backZ}`} {...e} clippingPlanes={clippingPlanes} steel={steel} sign={sign} />
      ))}
      {/* Salida de los sótanos: marcos, vidrio con el jardín de afuera y letreros */}
      <mesh geometry={facade.frame}>
        <meshLambertMaterial color={COLORS.facadeFrame} clippingPlanes={clippingPlanes} />
      </mesh>
      <mesh geometry={facade.glass}>
        <meshBasicMaterial map={outside} toneMapped={false} clippingPlanes={clippingPlanes} />
      </mesh>
      <mesh geometry={facade.sign}>
        <meshBasicMaterial color={COLORS.facadeSign} clippingPlanes={clippingPlanes} />
      </mesh>
      {/* Pasamanos de las escaleras */}
      <mesh geometry={rails}>
        <meshLambertMaterial color={COLORS.rail} clippingPlanes={clippingPlanes} />
      </mesh>
    </group>
  )
}
