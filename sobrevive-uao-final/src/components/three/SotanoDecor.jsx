import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import decorUrl from '../../assets/models/decoracion.fbx?url'
import { BASEMENT_SCALE, LEVEL, nav } from './basementLayout'

/**
 * Decoración de los sótanos con los modelos del equipo (decoracion.fbx trae los 6 objetos en fila):
 *
 *   1 mueble bajo (gris) · 2 puff redondo (gris o rojo) · 3 sofá: base gris y espaldar rojo, amarillo o verde
 *   4 dispensador de agua · 5 tres canecas seguidas (verde, blanca y gris) · 6 dos sillas unidas (6.1 amarilla
 *   o roja, 6.2 azul o verde)
 *
 * Ubicados según los bocetos del Sótano 2 y de labs 1 (Sótano 1), contra los muros (medidos con raycasts sobre el modelo). Todo se une en
 * una geometría por color (una llamada de dibujo por color), usa los cortes del piso y registra cajas
 * invisibles en `nav.blockers` para que no se puedan atravesar.
 */

/**
 * Muros donde va la decoración: coordenada del muro, hacia dónde queda (lado), tramo libre y piso (`y`, por
 * defecto el Sótano 2).
 */
const WALL = {
  westE: { x: -2.92, side: 1, span: [-17.9, 10.1] }, // corredor oeste, muro del patio
  westE_south: { x: -2.95, side: 1, span: [17.2, 28.3] }, // corredor oeste, al sur del ascensor sur
  westE_north: { x: -2.98, side: 1, span: [-37.2, -24.4] }, // corredor oeste, al norte del ascensor norte
  westW_south: { x: -14.77, side: -1, span: [22.8, 28.3] }, // corredor oeste, al sur del pasillo del ala suroeste
  westW: { x: -14.75, side: -1, span: [-37.3, -33.6] }, // corredor oeste, muro exterior (antes de la rampa)
  eastE: { x: 33.11, side: 1, span: [-37.4, -17.7] }, // corredor este, muro exterior (antes de la escalera norte)
  eastE_south: { x: 33.11, side: 1, span: [10.4, 37.4] }, // corredor este, muro exterior (después de la escalera sur)
  eastW: { x: 24.67, side: -1, span: [-37.4, -21.9] }, // corredor este, muro del patio (norte)
  eastW_south: { x: 24.79, side: -1, span: [14.6, 37.4] }, // corredor este, muro del patio (sur)
  crossS: { z: 14.56, side: 1, span: [-2.8, 24.7] }, // pasillo de cruce sur, muro sur
  swEnd: { x: -24.93, side: -1, span: [19.4, 22.6] }, // pasillo pequeño del ala suroeste, fondo
  // Sótano 1 (labs 1)
  s1WestE: { x: -2.98, side: 1, span: [-37.2, -24.4], y: LEVEL.s1 }, // corredor oeste, muro del patio (norte)
  s1WestW: { x: -14.87, side: -1, span: [-20.8, 19.2], y: LEVEL.s1 }, // corredor oeste, muro exterior
  s1EastW: { x: 24.67, side: -1, span: [-37.4, -21.9], y: LEVEL.s1 }, // corredor este, muro del patio (norte)
  s1ExitN: { z: -11.3, side: -1, span: [33.8, 38.6], y: LEVEL.s1 }, // salida de los sótanos, muro norte (murete)
  s1ExitS: { z: 4.25, side: 1, span: [33.8, 38.7], y: LEVEL.s1 }, // salida de los sótanos, muro sur (murete)
}

/** Tamaño de cada objeto respecto al modelo (más grandes para que llenen los pasillos). */
const SIZE = { mueble1: 2, mueble2: 2, mueble3: 2, sillas: 2, basura: 1.4, dispensador: 1.3 }
/** Espacio libre entre objetos seguidos sobre el mismo muro. */
const GAP = 0.12

const C = {
  gray: '#b4b7bb',
  white: '#ebebe7',
  red: '#cf3a3a',
  yellow: '#dcc23c',
  green: '#4f9e3c',
  darkGreen: '#2f7d45',
  blue: '#2f5fbf',
  metal: '#7e8389',
  water: '#7cc4ef',
}

/**
 * Qué hay en cada punto del boceto: tipo, muro, posición a lo largo del muro y colores.
 * Sin muro: `free: [x, z]` con su giro `rot` y su piso `y`. `scale` agranda o achica uno en particular.
 */
const ITEMS = [
  // corredor este (izquierda del boceto)
  { kind: 'mueble1', wall: 'eastE', at: -31.6 },
  { kind: 'mueble3', wall: 'eastE', at: -25.0, back: 'red' },
  { kind: 'mueble2', wall: 'eastE', at: -21.1, color: 'gray' },
  { kind: 'mueble1', wall: 'eastW', at: -34.2 },
  { kind: 'mueble3', wall: 'eastW', at: -27.0, back: 'yellow' },
  { kind: 'mueble3', wall: 'eastW', at: -25.5, back: 'green' },
  { kind: 'basura', wall: 'eastE_south', at: 22.0, color: 'darkGreen' },
  { kind: 'basura', wall: 'eastE_south', at: 22.9, color: 'white' },
  { kind: 'basura', wall: 'eastE_south', at: 23.8, color: 'gray' },
  { kind: 'dispensador', wall: 'eastW_south', at: 28.0 },
  // corredor este, extremo sur (más muebles para llenar el pasillo)
  { kind: 'sillas', wall: 'eastE_south', at: 13.5, seats: ['red', 'green'] },
  { kind: 'mueble1', wall: 'eastE_south', at: 17.5 },
  { kind: 'mueble3', wall: 'eastE_south', at: 27.5, back: 'green' },
  { kind: 'sillas', wall: 'eastE_south', at: 30.5, seats: ['yellow', 'blue'] },
  { kind: 'mueble2', wall: 'eastE_south', at: 33.5, color: 'red' },
  { kind: 'mueble1', wall: 'eastE_south', at: 36.0 },
  { kind: 'mueble1', wall: 'eastW_south', at: 17.5 },
  { kind: 'mueble3', wall: 'eastW_south', at: 21.0, back: 'yellow' },
  { kind: 'mueble3', wall: 'eastW_south', at: 24.5, back: 'red' },
  { kind: 'sillas', wall: 'eastW_south', at: 31.0, seats: ['red', 'green'] },
  { kind: 'mueble2', wall: 'eastW_south', at: 34.5, color: 'gray' },
  // pasillo de cruce sur
  { kind: 'dispensador', wall: 'crossS', at: 17.0 },
  // corredor oeste (centro del boceto), muro del patio
  { kind: 'sillas', wall: 'westE', at: -16.95, seats: ['yellow', 'blue'] },
  { kind: 'sillas', wall: 'westE', at: -15.75, seats: ['red', 'green'] },
  { kind: 'mueble1', wall: 'westE', at: -11.6 },
  { kind: 'sillas', wall: 'westE', at: -8.2, seats: ['yellow', 'blue'] },
  { kind: 'sillas', wall: 'westE', at: -5.9, seats: ['red', 'green'] },
  { kind: 'mueble3', wall: 'westE', at: 1.2, back: 'red' },
  { kind: 'mueble3', wall: 'westE', at: 2.7, back: 'yellow' },
  { kind: 'mueble2', wall: 'westE', at: 7.2, color: 'red' },
  { kind: 'mueble1', wall: 'westE_south', at: 18.8 },
  { kind: 'mueble3', wall: 'westE_south', at: 23.3, back: 'green' },
  { kind: 'mueble3', wall: 'westE_south', at: 24.8, back: 'red' },
  { kind: 'dispensador', wall: 'westW', at: -35.0 },
  // corredor oeste, extremo norte (frente a la entrada de la rampa)
  { kind: 'mueble3', wall: 'westE_north', at: -35.5, back: 'red' },
  { kind: 'sillas', wall: 'westE_north', at: -32.0, seats: ['yellow', 'blue'] },
  { kind: 'mueble1', wall: 'westE_north', at: -28.5 },
  { kind: 'mueble2', wall: 'westE_north', at: -25.8, color: 'gray' },
  // corredor oeste, esquina sur de la entrada al pasillo del ala suroeste
  { kind: 'dispensador', wall: 'westW_south', at: 23.3 },
  // ala oeste (derecha del boceto)
  { kind: 'mueble3', wall: 'swEnd', at: 21.0, back: 'yellow' },
  // Sótano 1 (plano de labs 1; las mesas están en LabsTables)
  { kind: 'basura', wall: 's1WestE', at: -25.2, color: 'darkGreen' },
  { kind: 'basura', wall: 's1WestE', at: -26.1, color: 'white' },
  { kind: 'basura', wall: 's1WestE', at: -27.0, color: 'gray' },
  { kind: 'dispensador', wall: 's1WestW', at: -15.5 },
  // contra el muro exterior, entre dos mesas de esa fila (sueltas en el corredor estorbaban el paso)
  { kind: 'basura', wall: 's1WestW', at: 10.8, color: 'darkGreen' },
  { kind: 'basura', wall: 's1WestW', at: 11.7, color: 'white' },
  { kind: 'basura', wall: 's1WestW', at: 12.6, color: 'gray' },
  { kind: 'mueble3', wall: 's1EastW', at: -30.7, back: 'red' },
  { kind: 'mueble3', wall: 's1EastW', at: -28.1, back: 'yellow' },
  { kind: 'basura', wall: 's1ExitN', at: 34.4, color: 'darkGreen' },
  { kind: 'basura', wall: 's1ExitN', at: 35.3, color: 'white' },
  { kind: 'basura', wall: 's1ExitN', at: 36.2, color: 'gray' },
  // los dos sofás junto a la salida, un poco más pequeños para que quepan entre la escalera y la fachada
  { kind: 'mueble3', wall: 's1ExitS', at: 35.4, back: 'green', scale: 0.9 },
  { kind: 'mueble3', wall: 's1ExitS', at: 38.0, back: 'red', scale: 0.9 },
]

/**
 * Piezas de cada objeto en decoracion.fbx (los objetos están en fila a lo largo de z, en unidades del modelo).
 * Cada pieza tiene un papel que decide su color.
 */
function classify(name, z) {
  if (z > 1400) return ['mueble1', 'body']
  if (z > 600) return ['mueble2', 'body']
  if (z > -100) return ['mueble3', name === 'Cubo001' ? 'back' : 'body']
  if (z > -600) return ['dispensador', 'body']
  if (z > -1200) return ['basura', 'body']
  // sillas: asiento y espaldar de cada puesto (6.1 es el de z mayor), el resto es la estructura metálica
  if (name === 'Cubo008' || name === 'Cubo007') return ['sillas', 'seat0']
  if (name === 'Cubo009' || name === 'Cubo010') return ['sillas', 'seat1']
  return ['sillas', 'frame']
}

/** Geometrías de cada objeto, centradas en su planta, apoyadas en y = 0 y a la escala de los sótanos. */
function buildParts(fbx) {
  fbx.updateMatrixWorld(true)
  const kinds = {}
  fbx.traverse((o) => {
    if (!o.isMesh) return
    const box = new THREE.Box3().setFromObject(o)
    const [kind, role] = classify(o.name, box.getCenter(new THREE.Vector3()).z)
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld)
    if (geo.index) geo = geo.toNonIndexed()
    // normales planas a partir de las caras (las del FBX vienen invertidas en algunas tapas): look low-poly
    for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k)
    geo.computeVertexNormals()
    const entry = (kinds[kind] ??= { kind, box: new THREE.Box3(), parts: [] })
    entry.box.union(box)
    entry.parts.push({ role, geo })
  })
  for (const entry of Object.values(kinds)) {
    const c = entry.box.getCenter(new THREE.Vector3())
    const k = BASEMENT_SCALE * SIZE[entry.kind]
    for (const p of entry.parts) p.geo.translate(-c.x, -entry.box.min.y, -c.z).scale(k, k, k)
    const size = entry.box.getSize(new THREE.Vector3()).multiplyScalar(k)
    entry.depth = size.x // el respaldo de los muebles queda hacia -x
    entry.length = size.z
    entry.height = size.y
  }
  return kinds
}

/** Color de una pieza según el objeto puesto. */
function colorOf(item, role) {
  if (item.kind === 'mueble3') return role === 'back' ? item.back : 'gray'
  if (item.kind === 'sillas') return role === 'seat0' ? item.seats[0] : role === 'seat1' ? item.seats[1] : 'metal'
  if (item.kind === 'dispensador') return 'white'
  return item.color ?? 'gray'
}

/**
 * Posición de cada objeto a lo largo de su muro: parte del punto del boceto y, si al agrandarlos se tocan,
 * separa los seguidos (manteniendo el grupo centrado donde estaba) sin salirse del tramo del muro.
 */
function layOut(kinds) {
  const pos = new Map()
  for (const wall of Object.keys(WALL)) {
    const [lo, hi] = WALL[wall].span
    const items = ITEMS.filter((it) => it.wall === wall).sort((a, b) => a.at - b.at)
    const len = (it) => kinds[it.kind].length * (it.scale ?? 1)
    // grupos de objetos que se tocan: se unen y quedan centrados en el promedio de sus puntos del boceto
    const groups = items.map((it) => ({ items: [it], width: len(it), center: it.at }))
    for (let i = 0; i < groups.length - 1; ) {
      const [g, n] = [groups[i], groups[i + 1]]
      if (g.center + g.width / 2 + GAP > n.center - n.width / 2) {
        const merged = [...g.items, ...n.items]
        groups.splice(i, 2, {
          items: merged,
          width: g.width + GAP + n.width,
          center: merged.reduce((sum, it) => sum + it.at, 0) / merged.length,
        })
        i = Math.max(0, i - 1)
      } else i++
    }
    // cada grupo dentro del tramo y sin montarse en el anterior
    let min = lo
    for (const g of groups) {
      let start = Math.min(Math.max(g.center - g.width / 2, min), hi - g.width)
      for (const it of g.items) {
        pos.set(it, start + len(it) / 2)
        start += len(it) + GAP
      }
      min = start
    }
  }
  return pos
}

/** Centro y giro de un objeto contra su muro: el respaldo (−x local) mira al muro. */
function placement(item, kind, at) {
  if (item.free) return { x: item.free[0], z: item.free[1], rot: item.rot ?? 0 }
  const w = WALL[item.wall]
  const off = (kind.depth * (item.scale ?? 1)) / 2 + 0.06
  if (w.x !== undefined) {
    // muro a lo largo de z
    return { x: w.x - w.side * off, z: at, rot: w.side > 0 ? Math.PI : 0 }
  }
  // muro a lo largo de x: el largo del objeto queda a lo largo de x
  return { x: at, z: w.z - w.side * off, rot: w.side > 0 ? Math.PI / 2 : -Math.PI / 2 }
}

export default function SotanoDecor({ clippingPlanes }) {
  const fbx = useLoader(FBXLoader, decorUrl)

  const { meshes, blockers } = useMemo(() => {
    const kinds = buildParts(fbx)
    const byColor = {}
    const blockers = []
    const at = layOut(kinds)
    for (const item of ITEMS) {
      const kind = kinds[item.kind]
      const { x, z, rot } = placement(item, kind, at.get(item))
      const y = (item.wall ? WALL[item.wall].y : item.y) ?? LEVEL.s2
      const k = item.scale ?? 1
      for (const { role, geo } of kind.parts) {
        ;(byColor[colorOf(item, role)] ??= []).push(geo.clone().scale(k, k, k).rotateY(rot).translate(x, y, z))
      }
      const along = Math.abs(Math.sin(rot)) > 0.5
      const [l, d] = [kind.length * k, kind.depth * k]
      const box = new THREE.Mesh(new THREE.BoxGeometry(along ? l : d, 1, along ? d : l), new THREE.MeshBasicMaterial())
      box.position.set(x, y + 0.5, z)
      box.visible = false
      box.updateMatrixWorld()
      blockers.push(box)
    }
    const meshes = Object.entries(byColor).map(([color, geos]) => ({ color: C[color], geometry: mergeGeometries(geos) }))
    return { meshes, blockers }
  }, [fbx])

  useEffect(() => {
    nav.blockers.push(...blockers)
    return () => {
      for (const b of blockers) {
        const i = nav.blockers.indexOf(b)
        if (i >= 0) nav.blockers.splice(i, 1)
      }
    }
  }, [blockers])

  return (
    <group>
      {meshes.map(({ color, geometry }) => (
        <mesh key={color} geometry={geometry}>
          {/* doble cara: algunas tapas del FBX vienen con las caras volteadas */}
          <meshLambertMaterial color={color} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
        </mesh>
      ))}
    </group>
  )
}

useLoader.preload(FBXLoader, decorUrl)
