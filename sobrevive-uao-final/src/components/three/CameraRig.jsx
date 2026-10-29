import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/useGameStore'
import { nav } from './basementLayout'

/**
 * Cámara en 3ª persona que sigue al avatar.
 * - Se acerca en los momentos de decisión (drama)
 * - Tiembla en la secuencia caótica y durante el sismo
 * - Orbita al personaje al ganar
 * - Se aleja en pantallas angostas (móvil)
 * - Si un muro queda entre la cámara y el personaje, sube y mira más desde arriba hasta verlo (y luego vuelve)
 */
const desired = new THREE.Vector3()
const lookTarget = new THREE.Vector3()
const head = new THREE.Vector3()
const toCam = new THREE.Vector3()
const ray = new THREE.Raycaster()

/** Solo cuentan los muros visibles: los del nivel del personaje (los del otro sótano están recortados). */
const VISIBLE_BELOW = 0.2
const VISIBLE_ABOVE = 2.3

/**
 * ¿Algo del nivel del personaje tapa la línea entre su cuerpo y la cámara?
 * Se prueba con todas las piezas (nav.floors): algunos muros, como los del hueco de las escaleras, vienen
 * en la misma pieza que el piso.
 */
function occluded(target, camPos) {
  if (!nav.floors.length) return false
  head.set(target.x, target.y + 0.4, target.z) // a la altura del cuerpo: es lo primero que tapa un muro bajo
  toCam.subVectors(camPos, head)
  const dist = toCam.length()
  ray.set(head, toCam.divideScalar(dist))
  ray.far = dist
  return ray
    .intersectObjects(nav.floors, false)
    .some(({ point }) => point.y > target.y - VISIBLE_BELOW && point.y < target.y + VISIBLE_ABOVE)
}

export default function CameraRig({ targetRef, hazard }) {
  const size = useThree((s) => s.size)
  const look = useRef(new THREE.Vector3())
  const elapsed = useRef(0)
  const overhead = useRef(0) // 0 = ángulo normal · 1 = casi cenital (cuando un muro tapa al personaje)

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    elapsed.current += dt
    const { phase, isOutside, tremor } = useGameStore.getState()
    const narrow = size.width < 640 || size.width / size.height < 0.9
    const target = targetRef.current

    // Bastante desde arriba: así los muros de los sótanos no tapan al personaje
    let off = narrow ? [0, 14, 9] : [0, 10.5, 7]
    if (phase === 'deciding' || phase === 'failed') off = off.map((v) => v * 0.78)
    // Si aun así un muro lo tapa, la cámara sube suavemente hasta quedar casi encima
    if (phase !== 'won') {
      desired.set(target.x + off[0], target.y + off[1], target.z + off[2])
      const goal = occluded(target, desired) ? 1 : 0
      overhead.current += (goal - overhead.current) * (1 - Math.exp(-dt * (goal ? 6 : 2)))
      const top = narrow ? [0, 16, 2.6] : [0, 12.5, 2.2]
      off = off.map((v, i) => THREE.MathUtils.lerp(v, top[i], overhead.current))
    }
    if (phase === 'won') {
      const a = elapsed.current * 0.4
      off = [Math.sin(a) * 8, 5, Math.cos(a) * 8]
    }

    desired.set(target.x + off[0], target.y + off[1], target.z + off[2])
    camera.position.lerp(desired, 1 - Math.exp(-dt * 3))
    // Al ganar miramos un poco más abajo: el personaje queda en la parte alta, sobre el panel final
    lookTarget.set(target.x, target.y + (phase === 'won' ? -1.2 : 0.8), target.z)
    look.current.lerp(lookTarget, 1 - Math.exp(-dt * 5))

    let shake = 0
    if (phase === 'failing') shake = 0.35
    // Terremoto: la pantalla tiembla todo el tiempo que el personaje siga en los sótanos
    else if (hazard === 'quake' && tremor && !isOutside && phase !== 'won') shake = phase === 'walking' ? 0.16 : 0.09
    if (shake)
      camera.position.add(desired.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake))

    camera.lookAt(look.current)
  })

  return null
}
