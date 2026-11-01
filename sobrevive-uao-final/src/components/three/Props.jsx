import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePixelTexture } from '../../utils/pixelTextures'

/**
 * Props low-poly reutilizables (sótanos + campus).
 * Son placeholders livianos: reemplazables por GLB individuales.
 */

/** Caja con textura pixel. `tex` = nombre de receta en pixelTextures.js */
export function TexBox({ size, tex, repeat = [1, 1], color = '#ffffff', ...rest }) {
  const map = usePixelTexture(tex, repeat[0], repeat[1])
  return (
    <mesh {...rest}>
      <boxGeometry args={size} />
      <meshLambertMaterial map={map} color={color} />
    </mesh>
  )
}

/** Plano con textura pixel (señales, flechas en el piso). */
export function TexPlane({ size = [1, 1], tex, emissive = false, transparent = false, ...rest }) {
  const map = usePixelTexture(tex)
  return (
    <mesh {...rest}>
      <planeGeometry args={size} />
      {emissive ? (
        <meshBasicMaterial map={map} transparent={transparent} alphaTest={transparent ? 0.5 : 0} toneMapped={false} />
      ) : (
        <meshLambertMaterial map={map} transparent={transparent} alphaTest={transparent ? 0.5 : 0} />
      )}
    </mesh>
  )
}

export function Palm({ position, height = 4, rotation = 0 }) {
  const fronds = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), [])
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.16, 0.24, height, 5]} />
        <meshLambertMaterial color="#7a5332" flatShading />
      </mesh>
      {fronds.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.8, height - 0.1, Math.sin(a) * 0.8]} rotation={[0, -a, -0.45]}>
          <boxGeometry args={[1.7, 0.08, 0.45]} />
          <meshLambertMaterial color={a % 2 ? '#3f8f3a' : '#2f7a2b'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

const CAR_COLORS = ['#c8102e', '#2b6cb0', '#e8e4dc', '#3a3a44', '#d9a400']

export function Car({ position, rotation = 0, color = 0 }) {
  const c = CAR_COLORS[color % CAR_COLORS.length]
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={0.45}>
        <boxGeometry args={[3.2, 0.6, 1.5]} />
        <meshLambertMaterial color={c} flatShading />
      </mesh>
      <mesh position={[-0.2, 0.95, 0]}>
        <boxGeometry args={[1.7, 0.5, 1.3]} />
        <meshLambertMaterial color="#9fd0ea" flatShading />
      </mesh>
      {[[-1, 0.7], [1, 0.7], [-1, -0.7], [1, -0.7]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.22, z]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.24, 0.24, 0.2, 6]} />
          <meshLambertMaterial color="#121214" />
        </mesh>
      ))}
    </group>
  )
}

export function Pillar({ position, height = 3.2 }) {
  return (
    <group position={position}>
      <TexBox size={[0.8, height, 0.8]} position-y={height / 2} tex="concrete" repeat={[1, 3]} />
      <TexBox size={[0.82, 0.6, 0.82]} position-y={0.3} tex="hazardStripes" />
    </group>
  )
}

/** Luz de emergencia roja que parpadea (todas comparten fase). */
export function EmergencyLight({ position, color = '#ff2a2a' }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    ref.current.color.set(Math.sin(clock.elapsedTime * 6) > 0 ? color : '#3a0a0a')
  })
  return (
    <mesh position={position}>
      <boxGeometry args={[0.5, 0.25, 0.2]} />
      <meshBasicMaterial ref={ref} color={color} toneMapped={false} />
    </mesh>
  )
}

export function Extinguisher({ position }) {
  return (
    <group position={position}>
      <mesh position-y={0.35}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 6]} />
        <meshLambertMaterial color="#d81e1e" flatShading />
      </mesh>
      <mesh position-y={0.78}>
        <boxGeometry args={[0.2, 0.16, 0.2]} />
        <meshLambertMaterial color="#222" />
      </mesh>
    </group>
  )
}

/** Señal de punto de encuentro sobre poste. */
export function MeetingSign({ position, rotation = 0 }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={1.2}>
        <cylinderGeometry args={[0.07, 0.07, 2.4, 5]} />
        <meshLambertMaterial color="#d8d8d8" />
      </mesh>
      <TexPlane tex="meetingSign" size={[1.3, 1.3]} position={[0, 2.5, 0.08]} emissive />
      <TexPlane tex="meetingSign" size={[1.3, 1.3]} position={[0, 2.5, -0.08]} rotation-y={Math.PI} emissive />
    </group>
  )
}
