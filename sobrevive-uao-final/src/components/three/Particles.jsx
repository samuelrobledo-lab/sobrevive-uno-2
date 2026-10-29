import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Sistema de partículas "voxel" (cubos instanciados) — encaja con la estética pixel art
 * y cuesta 1 draw call por emisor. Base para fuego, humo, gas, polvo, explosiones y escombros.
 */

const rand = (min, max) => min + Math.random() * (max - min)

export function VoxelParticles({
  count = 40,
  position = [0, 0, 0],
  area = [1, 0.2, 1], // caja de spawn (ancho, alto, profundo)
  colors = ['#ffffff'],
  life = [0.6, 1.4],
  speed = [0.5, 1.5], // velocidad vertical (multiplicada por `upward`)
  upward = 1, // 1 sube, -1 cae
  spread = 0.4, // velocidad lateral aleatoria
  drift = [0, 0, 0], // viento constante
  gravity = 0,
  size = [0.12, 0.25],
  sizeMode = 'shrink', // 'shrink' | 'grow'
  floor = -Infinity, // y local donde las partículas se detienen
  loop = true,
  opacity = 1,
}) {
  const mesh = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const p = useMemo(() => {
    const s = {
      pos: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      age: new Float32Array(count),
      life: new Float32Array(count),
      size: new Float32Array(count),
    }
    s.spawn = (i, stagger) => {
      s.pos[i * 3] = rand(-area[0], area[0]) / 2
      s.pos[i * 3 + 1] = rand(-area[1], area[1]) / 2
      s.pos[i * 3 + 2] = rand(-area[2], area[2]) / 2
      s.vel[i * 3] = rand(-spread, spread) + drift[0]
      s.vel[i * 3 + 1] = upward * rand(speed[0], speed[1]) + drift[1]
      s.vel[i * 3 + 2] = rand(-spread, spread) + drift[2]
      s.life[i] = rand(life[0], life[1])
      s.age[i] = stagger ? Math.random() * s.life[i] : 0
      s.size[i] = rand(size[0], size[1])
    }
    for (let i = 0; i < count; i++) s.spawn(i, loop)
    return s
    // Los props se tratan como configuración inicial del emisor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) mesh.current.setColorAt(i, c.set(colors[i % colors.length]))
    mesh.current.instanceColor.needsUpdate = true
  }, [count, colors])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    for (let i = 0; i < count; i++) {
      p.age[i] += dt
      if (p.age[i] > p.life[i]) {
        if (loop) p.spawn(i, false)
        else {
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          mesh.current.setMatrixAt(i, dummy.matrix)
          continue
        }
      }
      const k = i * 3
      p.vel[k + 1] -= gravity * dt
      p.pos[k] += p.vel[k] * dt
      p.pos[k + 1] += p.vel[k + 1] * dt
      p.pos[k + 2] += p.vel[k + 2] * dt
      if (p.pos[k + 1] < floor) {
        p.pos[k + 1] = floor
        p.vel[k] = p.vel[k + 1] = p.vel[k + 2] = 0
      }
      const t = p.age[i] / p.life[i]
      const s = p.size[i] * (sizeMode === 'grow' ? 0.5 + t * 1.5 : 1 - t * t)
      dummy.position.set(p.pos[k], p.pos[k + 1], p.pos[k + 2])
      dummy.rotation.set(0, i, 0)
      dummy.scale.setScalar(Math.max(s, 0.0001))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

const FIRE = ['#ffe066', '#ffb020', '#ff7a1a', '#e8401c']
const SMOKE = ['#2a2626', '#3b3636', '#4d4747']
const GAS = ['#8dff6a', '#5fd65a', '#b9ff9a']
const DUST = ['#c9b79c', '#a89a84', '#e0d2b8']

/** Luz puntual con parpadeo (fuego, chispas, alarmas). */
export function FlickerLight({ color = '#ff7a1a', intensity = 6, distance = 8, speed = 18, ...rest }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed
    ref.current.intensity = intensity * (0.75 + Math.sin(t) * 0.12 + Math.sin(t * 2.7) * 0.13)
  })
  return <pointLight ref={ref} color={color} intensity={intensity} distance={distance} decay={1.6} {...rest} />
}

export function Fire({ position, scale = 1, light = true }) {
  return (
    <group position={position}>
      <VoxelParticles count={Math.round(36 * scale)} area={[0.9 * scale, 0.1, 0.9 * scale]} colors={FIRE} life={[0.35, 0.9]} speed={[1, 2.2 * scale]} spread={0.25} size={[0.15 * scale, 0.34 * scale]} />
      <VoxelParticles position={[0, 1.2 * scale, 0]} count={18} area={[0.8 * scale, 0.4, 0.8 * scale]} colors={SMOKE} life={[1.6, 3]} speed={[0.6, 1.1]} drift={[0.25, 0, 0]} size={[0.3 * scale, 0.6 * scale]} sizeMode="grow" opacity={0.75} />
      {light && <FlickerLight position={[0, 1, 0]} intensity={5 * scale} distance={7 * scale} />}
    </group>
  )
}

export function Smoke({ position, scale = 1, count = 28 }) {
  return <VoxelParticles position={position} count={count} area={[2 * scale, 0.6, 2 * scale]} colors={SMOKE} life={[2.2, 4]} speed={[0.25, 0.6]} drift={[0.35, 0, 0]} spread={0.25} size={[0.4 * scale, 0.8 * scale]} sizeMode="grow" opacity={0.6} />
}

/** Nube de gas densa y baja (fuga de gas: tocarla ahoga), más visible que GasCloud. */
export function GasPuff({ position, scale = 1 }) {
  return <VoxelParticles position={position} count={Math.round(22 * scale)} area={[1.3 * scale, 0.5, 1.3 * scale]} colors={GAS} life={[1.8, 3.2]} speed={[0.1, 0.35]} spread={0.35} size={[0.3 * scale, 0.7 * scale]} sizeMode="grow" opacity={0.42} />
}

export function GasCloud({ position, scale = 1, count = 30 }) {
  return <VoxelParticles position={position} count={count} area={[2.4 * scale, 0.8, 2.4 * scale]} colors={GAS} life={[2.5, 4.5]} speed={[0.05, 0.25]} spread={0.3} size={[0.45 * scale, 0.9 * scale]} sizeMode="grow" opacity={0.16} />
}

export function Dust({ position, area = [12, 0.5, 10], count = 70 }) {
  return <VoxelParticles position={position} count={count} area={area} colors={DUST} life={[1.4, 2.4]} speed={[0.8, 1.6]} upward={-1} spread={0.15} size={[0.05, 0.11]} />
}

/** Explosión de un solo disparo (montar con `key` para repetir). */
export function Explosion({ position }) {
  const flash = useRef(null)
  useFrame((_, dt) => {
    const m = flash.current
    if (!m) return
    m.scale.addScalar(dt * 9)
    m.material.opacity = Math.max(0, m.material.opacity - dt * 1.6)
  })
  return (
    <group position={position}>
      <mesh ref={flash}>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial color="#fff2a8" transparent opacity={1} toneMapped={false} />
      </mesh>
      <VoxelParticles count={90} area={[0.6, 0.6, 0.6]} colors={FIRE} life={[0.5, 1.1]} speed={[2, 6]} spread={4} gravity={5} size={[0.2, 0.4]} loop={false} />
      <FlickerLight color="#ffcc66" intensity={14} distance={12} />
    </group>
  )
}

/** Escombros que caen sobre una posición (terremoto). */
export function Debris({ position }) {
  return (
    <group position={position}>
      <VoxelParticles position={[0, 5, 0]} count={40} area={[2.2, 1.5, 2.2]} colors={['#8a8378', '#6d6760', '#b8b0a2']} life={[2.5, 3]} speed={[0, 0.5]} upward={-1} spread={0.2} gravity={14} size={[0.18, 0.42]} floor={-4.85} loop={false} />
      <Dust position={[0, 2.5, 0]} area={[3, 1, 3]} count={50} />
    </group>
  )
}
