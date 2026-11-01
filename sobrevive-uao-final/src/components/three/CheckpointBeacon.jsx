import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEmergency, useGameStore } from '../../store/useGameStore'
import { SAFE_ZONE, stepTargets } from './basementLayout'

/**
 * Aro de luz en el piso sobre cada lugar donde sale la siguiente pregunta (o en la meta al final):
 * indica a dónde ir sin marcar el camino. Como un círculo mágico: un aro fino que brilla suave, un aro
 * interior más tenue y trazos de arco que giran en sentidos opuestos. Solo se ve mientras el personaje camina.
 * Si una pregunta puede salir en varios lugares (p. ej. cualquiera de las escaleras o la rampa), hay un aro en cada uno.
 * Cada aro solo se ve cuando el personaje está en su mismo piso.
 */
const SIZE = 2.2 // diámetro del dibujo (unidades de escena)
const GLOW = '#ffc23a' // amarillo
const CORE = '#fff1b8'

/** Dibuja aros y arcos (radios en fracción del canvas) con un brillo suave alrededor. */
function ringTexture(draw) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.translate(128, 128)
  g.lineCap = 'round'
  const stroke = (r, width, alpha, from = 0, to = Math.PI * 2) => {
    g.beginPath()
    g.arc(0, 0, r * 128, from, to)
    // primero el brillo (ancho y tenue), luego la línea clara del centro
    g.strokeStyle = GLOW
    g.globalAlpha = alpha * 0.5
    g.lineWidth = width * 4
    g.shadowColor = GLOW
    g.shadowBlur = 10
    g.stroke()
    g.shadowBlur = 0
    g.strokeStyle = CORE
    g.globalAlpha = alpha
    g.lineWidth = width
    g.stroke()
  }
  draw(stroke)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function CheckpointBeacon({ avatarRef }) {
  const emergency = useEmergency()
  const phase = useGameStore((s) => s.phase)
  const step = useGameStore((s) => s.currentStep)
  const group = useRef(null)
  // lugares del paso actual y de sus variantes (p. ej. la pregunta 4 en las escaleras o en la rampa)
  const spots = useMemo(
    () => (emergency ? stepTargets(emergency, step).flatMap(({ spots: list }) => list ?? [SAFE_ZONE.center]) : []),
    [emergency, step],
  )

  const textures = useMemo(() => {
    // halo muy suave sobre el piso
    const halo = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')
      const grad = g.createRadialGradient(32, 32, 6, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,194,58,0.18)')
      grad.addColorStop(0.7, 'rgba(255,194,58,0.22)')
      grad.addColorStop(1, 'rgba(255,194,58,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    })()
    return {
      halo,
      // aro principal (fino y claro) + aro interior tenue
      rings: ringTexture((stroke) => {
        stroke(0.8, 3, 0.95)
        stroke(0.56, 1.5, 0.4)
      }),
      // trazos de arco por fuera del aro: giran en un sentido
      outer: ringTexture((stroke) => {
        for (let i = 0; i < 3; i++) stroke(0.9, 2, 0.75, (i * 2 * Math.PI) / 3, (i * 2 * Math.PI) / 3 + 1.25)
      }),
      // y por dentro, en el otro
      inner: ringTexture((stroke) => {
        for (let i = 0; i < 4; i++) stroke(0.68, 1.5, 0.55, (i * Math.PI) / 2, (i * Math.PI) / 2 + 0.7)
      }),
    }
  }, [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    const pulse = 0.85 + Math.sin(t * 2.4) * 0.15 // brillo que respira, sin encandilar
    group.current.children.forEach((spot) => {
      // solo en el piso donde está el personaje (los cortes de los sótanos no aplican a los aros)
      spot.visible = !avatarRef || Math.abs(avatarRef.current.y - spot.position.y) < 1.5
      const [halo, rings, outer, inner] = spot.children
      halo.material.opacity = pulse
      rings.material.opacity = 0.75 + pulse * 0.2
      outer.rotation.z = t * 0.9
      inner.rotation.z = -t * 1.3
    })
  })

  if (phase !== 'walking') return null
  const layer = (map, z, order) => (
    <mesh position-z={z} renderOrder={order}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  )
  return (
    <group ref={group}>
      {spots.map(([x, y, z]) => (
        <group key={`${x}|${z}`} position={[x, y + 0.04, z]} rotation-x={-Math.PI / 2}>
          {layer(textures.halo, 0, 2)}
          {layer(textures.rings, 0.005, 3)}
          {layer(textures.outer, 0.01, 4)}
          {layer(textures.inner, 0.015, 5)}
        </group>
      ))}
    </group>
  )
}
