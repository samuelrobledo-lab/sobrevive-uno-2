import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../store/useGameStore'
import { sound } from '../../audio/sound'
import { Fire, Smoke, GasCloud, GasPuff, Dust, Explosion, Debris, FlickerLight, VoxelParticles } from './Particles'
import { DEBRIS_HITS, FIRES, GAS, LEVEL, nav } from './basementLayout'

/**
 * Efectos ambientales por amenaza (escalan con el avance) + secuencia caótica al fallar.
 * hazard: 'fire' | 'gas' | 'quake'
 */
export default function HazardEffects({ hazard, avatarRef }) {
  const currentStep = useGameStore((s) => s.currentStep)
  const phase = useGameStore((s) => s.phase)
  const attempts = useGameStore((s) => s.attempts)
  const cause = useGameStore((s) => s.failedOption?.id)
  const upstairs = useUpstairs(avatarRef)

  return (
    <>
      {hazard === 'fire' && <FireAmbient upstairs={upstairs} />}
      {hazard === 'gas' && <GasAmbient upstairs={upstairs} />}
      {hazard === 'quake' && <QuakeAmbient upstairs={upstairs} step={currentStep} />}
      {hazard === 'quake' && <BigDebris key={attempts} avatarRef={avatarRef} step={currentStep} />}
      {phase === 'failing' && (
        <FollowAvatar avatarRef={avatarRef}>
          <ChaosBurst key={attempts} hazard={hazard} cause={cause} />
        </FollowAvatar>
      )}
    </>
  )
}

function FireAmbient({ upstairs }) {
  return (
    <>
      {/* Llamas del boceto en zigzag en el piso del personaje (tocarlas quema, ver FIRES); una luz cada 4.
          Más fuego que humo: el humo de cada llama es poco y no hay nubes grandes que las tapen. */}
      {(upstairs ? FIRES.s1 : FIRES.s2).map((position, i) => (
        <Fire key={`${upstairs}${i}`} position={position} scale={1} light={i % 4 === 0} />
      ))}
    </>
  )
}

function GasAmbient({ upstairs }) {
  return (
    <>
      {/* Nubes de gas del boceto en el piso del personaje (tocarlas ahoga, ver GAS) */}
      {(upstairs ? GAS.s1 : GAS.s2).map(([x, y, z], i) => (
        <GasPuff key={`${upstairs}${i}`} position={[x, y + 0.5, z]} />
      ))}
      {/* olor en el aire: una bruma muy suave por todo el piso */}
      <GasCloud position={[10, (upstairs ? LEVEL.s1 : LEVEL.s2) + 1.2, -4]} scale={3} count={30} />
    </>
  )
}

/**
 * Terremoto, Sótano 2: mientras tiembla caen pedacitos del techo a lo largo de los pasillos del recorrido
 * (pocos al principio; después de la pregunta 2, el ascensor, muchos más): [x, z, ancho en x, largo en z].
 */
const FALLING_S2 = [
  [-8.8, 0, 9, 34], // corredor oeste
  [11, -19.5, 22, 3.5], // pasillo de cruce norte
  [11, 12.4, 22, 3.5], // pasillo de cruce sur
  [29, -10, 6, 22], // corredor este, norte
  [29, 18, 6, 22], // corredor este, sur
  [-19.5, 21, 9, 2.5], // ala suroeste
  [-8.8, -27, 9, 20], // corredor oeste, al norte
  [-22, -31.5, 16, 3.5], // pasillo de la rampa
]

function QuakeAmbient({ upstairs, step }) {
  const isOutside = useGameStore((s) => s.isOutside)
  const tremor = useGameStore((s) => s.tremor)
  const heavy = step >= 2 // después de la pregunta 2 caen muchas más cosas
  const amount = heavy ? 1 : 0.35
  return (
    <>
      {/* Mientras el personaje siga en los sótanos tiembla: polvo y pedacitos del techo cayendo */}
      {tremor && !isOutside && (
        <>
          {/* Sótano 2 (bajo el piso del Sótano 1) y Sótano 1 */}
          {upstairs ? (
            <>
              <Dust position={[-8.8, LEVEL.s1 + 2.2, -8]} area={[10, 0.4, 30]} count={100} />
              <FallingChunks position={[-8.8, LEVEL.s1 + CHUNK_DROP, -8]} area={[9, 0.4, 28]} count={Math.round(50 * amount)} />
              <FlickerLight position={[-8.8, LEVEL.s1 + 2.4, -12]} color="#ffe6c4" intensity={3} distance={16} speed={26} />
            </>
          ) : (
            <>
              <Dust position={[-8.8, LEVEL.s2 + 2.4, 0]} area={[10, 0.4, 36]} count={120} />
              {FALLING_S2.map(([x, z, w, d]) => (
                <FallingChunks
                  key={`${x}|${z}|${heavy}`}
                  position={[x, LEVEL.s2 + CHUNK_DROP, z]}
                  area={[w, 0.4, d]}
                  count={Math.round(Math.min(70, Math.max(16, (w * d) / 4)) * amount)}
                />
              ))}
              <FlickerLight position={[-8.8, LEVEL.s2 + 2.2, 4]} color="#ffe6c4" intensity={3} distance={16} speed={30} />
            </>
          )}
        </>
      )}
      {/* Escombros estáticos */}
      {[
        [-12.6, LEVEL.s2, 8, 0.5],
        [-5, LEVEL.s2, -10, 0.7],
        [-12.8, LEVEL.s1, -2, 0.6],
        [10, LEVEL.s1, -18.5, 0.4],
      ]
        .filter(([, y]) => upstairs === y >= LEVEL.s1)
        .map(([x, y, z, s]) => (
          <mesh key={`${x}${z}`} position={[x, y + s / 2, z]} rotation={[0.3, x, 0.2]}>
            <boxGeometry args={[s, s, s * 1.3]} />
            <meshLambertMaterial color="#8a8378" flatShading />
          </mesh>
        ))}
    </>
  )
}

/** ¿El avatar ya pasó la mitad de la rampa? Cada nivel muestra solo sus efectos, igual que el modelo. */
function useUpstairs(avatarRef) {
  const [upstairs, setUpstairs] = useState(false)
  useFrame(() => {
    const up = avatarRef.current.y > LEVEL.s1 / 2
    if (up !== upstairs) setUpstairs(up)
  })
  return upstairs
}

/** Altura (sobre el piso) desde la que caen los pedazos de cielo raso. */
const CHUNK_DROP = 2.6

/** Pedazos de cielo raso que caen en loop y quedan un momento en el piso. */
function FallingChunks({ position, area, count = 22 }) {
  return (
    <VoxelParticles
      position={position}
      count={count}
      area={area}
      colors={['#8a8378', '#b8b0a2', '#6d6760']}
      life={[1.6, 3.2]}
      speed={[0, 0.4]}
      upward={-1}
      spread={0.1}
      gravity={12}
      size={[0.2, 0.45]}
      floor={-CHUNK_DROP + 0.12} // quedan un momento sobre el piso (se sueltan a CHUNK_DROP de altura)
    />
  )
}

/*
 * Terremoto: cada cierto tiempo se desprende un pedazo grande del techo cerca del personaje (hacia donde va).
 * Primero se ve su sombra en el piso con un aro rojo que parpadea y cruje el techo (AVISO), luego cae; si al
 * caer el personaje está debajo, muere (como al tocar el fuego, ver DEBRIS_HITS en basementLayout).
 */
const BIG = {
  slots: 3, // pedazos a la vez
  warn: 1.5, // s de aviso (sombra) antes de caer
  fall: 0.32, // s de caída
  rest: 3.5, // s en el piso antes de desaparecer
  every: [[4, 6], [2.4, 3.8]], // s entre pedazos: antes / después de la pregunta 2
  drop: CHUNK_DROP + 1.2, // altura desde la que cae
  size: [1.3, 1.8],
}
const randIn = ([a, b]) => a + Math.random() * (b - a)

function BigDebris({ avatarRef, step }) {
  const slots = useRef(Array.from({ length: BIG.slots }, () => ({ active: false })))
  const refs = useRef([])
  const next = useRef(randIn([1.5, 2.5])) // el primero sale pronto
  const last = useRef(null)
  const vel = useRef(new THREE.Vector3())

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const { phase, tremor, isOutside } = useGameStore.getState()
    const a = avatarRef.current
    // velocidad del personaje (suavizada): los pedazos caen hacia donde va
    if (last.current) vel.current.lerp(tmpV.copy(a).sub(last.current).divideScalar(dt || 1), 0.1)
    last.current = (last.current ?? new THREE.Vector3()).copy(a)
    vel.current.clampLength(0, 4) // (un salto de posición, p. ej. una transición, no cuenta)

    // nuevo pedazo
    if (phase === 'walking' && tremor && !isOutside && (next.current -= dt) <= 0) {
      next.current = randIn(BIG.every[step >= 2 ? 1 : 0])
      const slot = slots.current.find((s) => !s.active)
      const spot = slot && pickSpot(a, vel.current)
      if (spot) Object.assign(slot, { active: true, t: 0, x: spot[0], y: spot[1], z: spot[2], size: randIn(BIG.size), spin: Math.random() * 6, hit: false, crushed: false })
      if (spot) sound.sfx.crack()
    }

    slots.current.forEach((s, i) => {
      const r = refs.current[i]
      if (!r) return
      r.group.visible = s.active
      if (!s.active) return
      s.t += dt
      const { warn, fall, rest } = BIG
      r.group.position.set(s.x, s.y, s.z)
      // sombra que crece y aro rojo que parpadea mientras avisa
      const w = Math.min(1, s.t / warn)
      r.shadow.visible = s.t < warn + fall
      r.shadow.scale.setScalar(s.size * (0.35 + 0.65 * w))
      r.shadow.material.opacity = 0.2 + 0.4 * w
      r.ring.visible = s.t < warn + fall
      r.ring.scale.setScalar(s.size)
      r.ring.material.opacity = 0.45 + 0.45 * Math.abs(Math.sin(s.t * (6 + 10 * w)))
      // el pedazo: cae al terminar el aviso
      const f = THREE.MathUtils.clamp((s.t - warn) / fall, 0, 1)
      r.chunk.visible = s.t >= warn
      r.chunk.scale.setScalar(s.size)
      r.chunk.position.y = s.size * 0.35 + (1 - f * f) * BIG.drop
      r.chunk.rotation.set(s.spin, s.spin * 0.7 + (1 - f) * 3, 0.3)
      if (f >= 1 && !s.hit) {
        s.hit = true
        const hit = [s.x, s.y, s.z, s.size * 0.6]
        DEBRIS_HITS.push(hit)
        setTimeout(() => DEBRIS_HITS.splice(DEBRIS_HITS.indexOf(hit), 1), 150)
        sound.sfx.crash()
        // si cayó encima del personaje, se deshace enseguida para que se vea aplastado
        s.crushed = Math.hypot(a.x - s.x, a.z - s.z) < hit[3] && Math.abs(a.y - s.y) < 1
      }
      // ya en el piso: se hunde y desaparece (enseguida si aplastó al personaje)
      const gone = THREE.MathUtils.clamp((s.t - warn - fall - (s.crushed ? 0.15 : rest)) / (s.crushed ? 0.25 : 0.6), 0, 1)
      if (gone > 0) r.chunk.position.y -= gone * s.size * 0.8
      if (gone >= 1) s.active = false
    })
  })

  return (
    <>
      {slots.current.map((_, i) => (
        <group key={i} ref={(g) => g && (refs.current[i] = refs.current[i] ?? collect(g))} visible={false}>
          <mesh name="shadow" rotation-x={-Math.PI / 2} position-y={0.04}>
            <circleGeometry args={[0.6, 16]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh name="ring" rotation-x={-Math.PI / 2} position-y={0.05}>
            <ringGeometry args={[0.55, 0.66, 20]} />
            <meshBasicMaterial color="#FF051E" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh name="chunk">
            <dodecahedronGeometry args={[0.5, 0]} />
            <meshLambertMaterial color="#8a8378" flatShading />
          </mesh>
        </group>
      ))}
    </>
  )
}

const tmpV = new THREE.Vector3()
const collect = (g) => ({ group: g, shadow: g.getObjectByName('shadow'), ring: g.getObjectByName('ring'), chunk: g.getObjectByName('chunk') })

/** Lugar del piso (en el nivel del personaje) cerca de él y hacia donde camina, al que pueda llegar sin muros. */
function pickSpot(a, vel) {
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2
    const d = Math.random() * 1.6
    const x = a.x + vel.x * BIG.warn * 0.6 + Math.cos(ang) * d
    const z = a.z + vel.z * BIG.warn * 0.6 + Math.sin(ang) * d
    const y = nav.move(a.x, a.y, a.z, x, z)
    if (y !== null && Math.abs(y - a.y) < 0.3) return [x, y, z]
  }
  return null
}

/** Mantiene a sus hijos sobre la posición actual del avatar. */
function FollowAvatar({ avatarRef, children }) {
  const ref = useRef(null)
  useFrame(() => ref.current.position.copy(avatarRef.current))
  return <group ref={ref}>{children}</group>
}

/** Secuencia caótica "Dumb Ways to Die": exagerada, ruidosa, pero breve. */
function ChaosBurst({ hazard, cause }) {
  // tocó el fuego: se quema vivo entre llamas · tocó el gas: se ahoga dentro de una nube (sin explosión)
  if (cause === 'fire') return <Fire position={[0, 0, 0]} scale={1.6} />
  if (cause === 'gas')
    return (
      <>
        <GasPuff position={[0, 0.6, 0]} scale={1.6} />
        <GasCloud position={[0, 1, 0]} scale={0.8} count={20} />
      </>
    )
  if (hazard === 'fire')
    return (
      <>
        <Fire position={[0, 0, 0]} scale={1.8} />
        <Smoke position={[0, 1.5, 0]} scale={1.5} count={40} />
      </>
    )
  if (hazard === 'gas')
    return (
      <>
        <Explosion position={[0, 0.8, 0]} />
        <Smoke position={[0, 1.2, 0]} scale={1.4} />
      </>
    )
  return <Debris position={[0, 0, 0]} />
}
