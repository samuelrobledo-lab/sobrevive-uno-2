import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { PIN_PALETTE, PIN_SPRITE, spriteToTexture } from '../../utils/sprites'

/**
 * Pin interactivo del mapa: sprite pixel art 2D (siempre mirando a la cámara).
 * Hover → crece + etiqueta. Click → onSelect(id).
 */
const RISK_HEX = { alto: '#c8102e', medio: '#ffb020', bajo: '#22e07a' }
const PIN_W = 2.3
const PIN_H = (PIN_W * PIN_SPRITE.length) / PIN_SPRITE[0].length
const scaleTarget = new THREE.Vector3()

// Textura compartida por todos los pins
let pinTexture = null
const getPinTexture = () => (pinTexture ??= spriteToTexture(PIN_SPRITE, PIN_PALETTE))

export default function Hotspot({ zone, index, active, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const pin = useRef(null)
  const ring = useRef(null)
  useCursor(hovered)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    pin.current.position.y = 0.35 + PIN_H / 2 + Math.abs(Math.sin(t * 2 + index)) * 0.25
    const s = active || hovered ? 1.35 : 1
    pin.current.scale.lerp(scaleTarget.set(s, s, s), 0.2)
    const r = 1 + ((t * 0.8 + index * 0.3) % 1) * 1.2
    ring.current.scale.set(r, r, r)
    ring.current.material.opacity = 1.1 - r / 2.2
  })

  return (
    <group position={zone.position}>
      <group ref={pin}>
        <Billboard>
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              onSelect(zone.id)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHovered(true)
            }}
            onPointerOut={() => setHovered(false)}
          >
            <planeGeometry args={[PIN_W, PIN_H]} />
            <meshBasicMaterial map={getPinTexture()} transparent alphaTest={0.5} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>

      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.08}>
        <ringGeometry args={[0.45, 0.65, 6]} />
        <meshBasicMaterial color={RISK_HEX[zone.risk]} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {(hovered || active) && (
        <Html center position={[0, PIN_H + 1.6, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="glass-pixel pixel-corners whitespace-nowrap px-3 py-2 font-pixel text-[0.55rem] text-white">
            {zone.name}
          </div>
        </Html>
      )}
    </group>
  )
}
