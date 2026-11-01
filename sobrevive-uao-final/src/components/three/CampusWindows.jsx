import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Todas las ventanas del campus en solo 3 mallas (marco, vidrio y reflejo).
 * Cada ventana es: marco beige + `panes` vidrios aguamarina con un reflejo pixel en la esquina.
 * Unirlas en una geometría por material evita cientos de llamadas de dibujo por cuadro.
 *
 * spec: { position: [x, y, z], rotationY, w, h, panes = 3 }
 */

export const WINDOW_COLORS = { frame: '#e6d7b6', glass: '#3f9d90', glint: '#6cbcae' }

const M = 0.12 // ancho del marco
const GAP = 0.09 // separación entre vidrios
const GLINT = 0.12 // tamaño del reflejo

const plane = (w, h, x, y, z, matrix) => new THREE.PlaneGeometry(w, h).translate(x, y, z).applyMatrix4(matrix)

/** Construye (y cachea) las 3 geometrías unidas para una lista de ventanas. */
const cache = new WeakMap()
export function buildWindowGeometries(specs) {
  if (cache.has(specs)) return cache.get(specs)
  const parts = { frame: [], glass: [], glint: [] }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  specs.forEach(({ position, rotationY, w, h, panes = 3 }) => {
    m.compose(new THREE.Vector3(...position), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotationY), one)
    parts.frame.push(plane(w, h, 0, 0, 0, m))
    const pw = (w - M * 2 - GAP * (panes - 1)) / panes
    const ph = h - M * 2
    for (let i = 0; i < panes; i++) {
      const cx = -w / 2 + M + pw / 2 + i * (pw + GAP)
      parts.glass.push(plane(pw, ph, cx, 0, 0.01, m))
      parts.glint.push(plane(GLINT, GLINT, cx - pw / 2 + GLINT, ph / 2 - GLINT, 0.015, m))
    }
  })
  const merged = Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, mergeGeometries(list)]))
  Object.values(parts).flat().forEach((g) => g.dispose())
  cache.set(specs, merged)
  return merged
}

export default function CampusWindows({ specs }) {
  const geo = useMemo(() => buildWindowGeometries(specs), [specs])
  return (
    <group>
      <mesh geometry={geo.frame}>
        <meshLambertMaterial color={WINDOW_COLORS.frame} />
      </mesh>
      <mesh geometry={geo.glass}>
        {/* vidrio y reflejo van a milímetros del marco: prioridad de profundidad para que no parpadeen de lejos */}
        <meshLambertMaterial color={WINDOW_COLORS.glass} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh geometry={geo.glint}>
        <meshBasicMaterial color={WINDOW_COLORS.glint} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
    </group>
  )
}
