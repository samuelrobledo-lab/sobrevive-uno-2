import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../store/useGameStore'
import { Fire, Smoke, GasCloud, GasPuff, Dust, Explosion, Debris, FlickerLight, VoxelParticles } from './Particles'
import { FIRES, GAS, LEVEL } from './basementLayout'

/**
 * Efectos ambientales por amenaza (escalan con el avance) + secuencia caótica al fallar.
 * hazard: 'fire' | 'gas' | 'quake'
 */
export default function HazardEffects({ hazard, avatarRef }) {
  const currentStep = useGameStore((s) => s.currentStep)
  const phase = useGameStore((s) => s.phase)
  const attempts = useGameStore((s) => s.attempts)
  const upstairs = useUpstairs(avatarRef)

  return (
    <>
      {hazard === 'fire' && <FireAmbient step={currentStep} upstairs={upstairs} />}
      {hazard === 'gas' && <GasAmbient upstairs={upstairs} />}
      {hazard === 'quake' && <QuakeAmbient upstairs={upstairs} step={currentStep} />}
      {phase === 'failing' && (
        <FollowAvatar avatarRef={avatarRef}>
          <ChaosBurst key={attempts} hazard={hazard} />
        </FollowAvatar>
      )}
    </>
  )
}

function FireAmbient({ step, upstairs }) {
  return (
    <>
      {/* Llamas del boceto en el piso del personaje (tocarlas quema, ver FIRES) con un poco de humo; una luz cada 4 */}
      {(upstairs ? FIRES.s1 : FIRES.s2).map((position, i) => (
        <Fire key={`${upstairs}${i}`} position={position} scale={1} light={i % 4 === 0} />
      ))}
      {!upstairs && (
        <>
          <Smoke position={[-11, LEVEL.s2 + 1.6, -3]} scale={1.4} count={30} />
          <Smoke position={[8, LEVEL.s2 + 1.8, -19.6]} scale={1.1} count={20} />
          <Smoke position={[28.5, LEVEL.s2 + 1.8, -3]} scale={1.1} count={20} />
        </>
      )}
      {upstairs && (
        <>
          <Smoke position={[-9, LEVEL.s1 + 1.6, -6]} scale={1.4} count={30} />
          <Smoke position={[11, LEVEL.s1 + 1.8, -19.6]} scale={1.2} count={24} />
          <Smoke position={[9, LEVEL.s1 + 1.8, 12.4]} scale={1.1} count={20} />
        </>
      )}
      {upstairs && step >= 2 && <Smoke position={[20, LEVEL.s1 + 1.8, -19.6]} scale={1.2} />}
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
 * Terremoto, Sótano 2: después de la pregunta 2 (el ascensor) empiezan a caer cosas del techo a lo largo de
 * los pasillos del recorrido: [x, z, ancho en x, largo en z].
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
  const falling = step >= 2 // después de la pregunta 2
  return (
    <>
      {/* Mientras el personaje siga en los sótanos tiembla: polvo; después de la pregunta 2 también caen cosas */}
      {tremor && !isOutside && (
        <>
          {/* Sótano 2 (bajo el piso del Sótano 1) y Sótano 1 */}
          {upstairs ? (
            <>
              <Dust position={[-8.8, LEVEL.s1 + 2.2, -8]} area={[10, 0.4, 30]} count={100} />
              {falling && <FallingChunks position={[-8.8, LEVEL.s1 + CHUNK_DROP, -8]} area={[9, 0.4, 28]} count={50} />}
              <FlickerLight position={[-8.8, LEVEL.s1 + 2.4, -12]} color="#ffe6c4" intensity={3} distance={16} speed={26} />
            </>
          ) : (
            <>
              <Dust position={[-8.8, LEVEL.s2 + 2.4, 0]} area={[10, 0.4, 36]} count={120} />
              {falling &&
                FALLING_S2.map(([x, z, w, d]) => (
                  <FallingChunks
                    key={`${x}|${z}`}
                    position={[x, LEVEL.s2 + CHUNK_DROP, z]}
                    area={[w, 0.4, d]}
                    count={Math.round(Math.min(70, Math.max(16, (w * d) / 4)))}
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

/** Mantiene a sus hijos sobre la posición actual del avatar. */
function FollowAvatar({ avatarRef, children }) {
  const ref = useRef(null)
  useFrame(() => ref.current.position.copy(avatarRef.current))
  return <group ref={ref}>{children}</group>
}

/** Secuencia caótica "Dumb Ways to Die": exagerada, ruidosa, pero breve. */
function ChaosBurst({ hazard }) {
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
