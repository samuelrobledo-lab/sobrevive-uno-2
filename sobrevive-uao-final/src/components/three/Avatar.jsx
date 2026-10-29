import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CALM_MS, WAKE_MS, useEmergency, useGameStore } from '../../store/useGameStore'
import { FRAME_COUNT, frameAt, getCharacter } from '../../data/characters'
import { pixelateTexture } from '../../utils/pixelTextures'
import { SPOTS, nav, routeStart, stepReached, touchesHazard } from './basementLayout'
import { WALK_SPEED } from '../../config'
import { inputDirection } from '../../utils/playerInput'
import { sound } from '../../audio/sound'

/**
 * Personaje pixel art 2D (billboard) dentro de la escena 3D, estilo Soulbound.
 * Usa el spritesheet del personaje elegido (data/characters.js).
 *
 * - intro / waking → si la ruta empieza acostado (route.lying): acostado en el piso; al sonar la alarma
 *               tiembla, se levanta de un salto y mira asustado a los lados (luego sale la 1.ª pregunta)
 * - walking  → el usuario lo mueve libremente (flechas / W A S D / cruceta táctil); anima "walk" al moverse.
 *               Al llegar a cualquiera de los lugares del paso actual (stepSpots) llama arriveAt(paso) y,
 *               tras la última decisión, al llegar a la meta (o al punto de encuentro) llama arriveAt('safe')
 * - deciding → quieto (fotograma 0)
 * - failing  → pánico: camina muy rápido hacia `failTarget` o en círculos
 * - won      → animación "jump" en loop
 *
 * Los sprites miran a la derecha: al moverse hacia -X se espejan (scale.x = -1).
 */

const AVATAR_HEIGHT = 1.7
const HOP = 0.12 // salto extra (unidades) en los fotogramas altos de la caminata
const ASLEEP_MS = 1400 // al sonar la alarma sigue acostado (temblando) este tiempo antes de levantarse
const tmp = new THREE.Vector3()
const dir = { x: 0, z: 0 }

export default function Avatar({ positionRef }) {
  const group = useRef(null)
  const bobber = useRef(null)
  const sprite = useRef(null)

  const character = getCharacter(useGameStore((s) => s.selectedCharacter))
  const baseTexture = useTexture(character.sheet)
  const texture = useMemo(() => {
    const t = pixelateTexture(baseTexture.clone())
    t.repeat.set(1 / FRAME_COUNT, 1)
    return t
  }, [baseTexture])
  const width = (AVATAR_HEIGHT * character.frameW) / character.frameH

  const runId = useGameStore((s) => s.runId)
  const attempts = useGameStore((s) => s.attempts)
  const emergency = useEmergency()
  const start = routeStart(emergency)
  const lying = !!emergency?.route?.lying
  const calm = !!emergency?.route?.calm
  const seated = !!emergency?.route?.seated

  const anchor = useRef(new THREE.Vector3(...start)) // último punto de control alcanzado
  const wakeAt = useRef(-1) // momento (s) en que empezó a despertarse
  const burnAt = useRef(new THREE.Vector3()) // dónde se quemó (ahí entra en pánico)
  const facing = useRef(1)
  const clock = useRef(0)
  const lastFrame = useRef(-1)

  // Nueva partida → volver al inicio
  useLayoutEffect(() => {
    anchor.current.set(...start)
    group.current.position.copy(anchor.current)
    positionRef.current.copy(anchor.current)
    wakeAt.current = -1
  }, [runId, positionRef, start])

  // Transición (pantalla en negro) → aparece en otro lugar, que pasa a ser el punto de control
  const teleport = useGameStore((s) => s.teleport)
  useLayoutEffect(() => {
    if (!teleport.to) return
    anchor.current.set(...SPOTS[teleport.to])
    group.current.position.copy(anchor.current)
    positionRef.current.copy(anchor.current)
  }, [teleport, positionRef])

  // Reintento → volver al punto de control de la decisión fallida
  useLayoutEffect(() => {
    group.current.position.copy(anchor.current)
  }, [attempts])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = (clock.current += dt)
    const ms = t * 1000
    const { phase, failedOption, arriveAt } = useGameStore.getState()
    const g = group.current.position
    let frame = 0
    let lift = 0
    let tilt = 0 // giro del sprite: π/2 = acostado

    if (lying && (phase === 'intro' || phase === 'waking')) {
      // Acostado en el piso; al sonar la alarma se sobresalta y se levanta de un salto
      if (phase === 'waking' && wakeAt.current < 0) wakeAt.current = t
      const woke = phase === 'waking' ? (t - wakeAt.current) * 1000 : 0
      const getUp = THREE.MathUtils.clamp((woke - ASLEEP_MS) / 250, 0, 1)
      tilt = (Math.PI / 2) * (1 - getUp)
      if (woke > 0 && woke < ASLEEP_MS) lift = Math.abs(Math.sin(woke / 40)) * 0.05 // tiembla del susto
      if (getUp > 0) {
        frame = frameAt('panic', ms)
        lift += Math.sin(getUp * Math.PI) * 0.5
        if (woke > ASLEEP_MS + 400) facing.current = Math.sin(woke / 180) > 0 ? 1 : -1 // mira a los lados
      }
      if (woke > WAKE_MS) tilt = 0
    } else if (seated && (phase === 'intro' || phase === 'waking')) {
      // Sentado estudiando (detrás de la mesita); al oler el gas se pone de pie asustado y mira a los lados
      if (phase === 'waking' && wakeAt.current < 0) wakeAt.current = t
      const since = phase === 'waking' ? (t - wakeAt.current) * 1000 : 0
      facing.current = 1
      if (since > ASLEEP_MS) {
        frame = frameAt('panic', ms)
        lift = Math.abs(Math.sin(since / 70)) * 0.05
        facing.current = Math.sin(since / 220) > 0 ? 1 : -1
      } else lift = -0.35 // sentado: más bajo, la mesita le tapa las piernas
    } else if (calm && phase === 'waking') {
      // Camina tranquilo por el pasillo; al empezar a temblar se detiene asustado y mira a los lados
      if (wakeAt.current < 0) wakeAt.current = t
      const since = (t - wakeAt.current) * 1000
      if (since < CALM_MS) {
        const y = nav.move(g.x, g.y, g.z, g.x + 1.2 * dt, g.z)
        if (y !== null) g.set(g.x + 1.2 * dt, y, g.z)
        facing.current = 1
        frame = frameAt('walk', ms)
      } else {
        frame = frameAt('panic', ms)
        lift = Math.abs(Math.sin(since / 60)) * 0.06
        facing.current = Math.sin(since / 200) > 0 ? 1 : -1
      }
    } else if (phase === 'walking') {
      inputDirection(dir)
      const len = Math.hypot(dir.x, dir.z)
      if (len > 0) {
        const step = (WALK_SPEED * dt) / len
        const nx = g.x + dir.x * step
        const nz = g.z + dir.z * step
        // Camina sobre el modelo; si choca, intenta deslizarse por cada eje (así puede "rozar" los muros)
        let y = nav.move(g.x, g.y, g.z, nx, nz)
        if (y !== null) g.set(nx, y, nz)
        else if (dir.x && (y = nav.move(g.x, g.y, g.z, nx, g.z)) !== null) g.set(nx, y, g.z)
        else if (dir.z && (y = nav.move(g.x, g.y, g.z, g.x, nz)) !== null) g.set(g.x, y, nz)
        if (dir.x) facing.current = Math.sign(dir.x)
        frame = frameAt('walk', ms)
        if (frame % 2 === 1) lift = HOP
      } else {
        frame = frameAt('idle', ms)
      }

      // Incendio / fuga de gas: tocar las llamas o el gas mata al personaje
      const { currentStep } = useGameStore.getState()
      if (touchesHazard(emergency.hazard, g.x, g.y, g.z)) {
        burnAt.current.copy(g)
        useGameStore.getState().burn()
      }
      // Puntos de control: la siguiente pregunta (en cualquiera de sus lugares, o una variante) y al final la meta
      else {
        const reached = stepReached(emergency, currentStep, g.x, g.y, g.z)
        if (reached >= 0) {
          if (reached < emergency.decisions.length) {
            anchor.current.copy(g)
            arriveAt(reached)
          } else arriveAt('safe')
        }
      }
    } else if (phase === 'failing') {
      frame = frameAt('panic', ms)
      // failTarget puede ser una lista de lugares: corre al más cercano
      const targets = [failedOption?.failTarget]
        .flat()
        .filter(Boolean)
        .map((key) => SPOTS[key])
      const target = targets.sort((a, b) => Math.hypot(a[0] - g.x, a[2] - g.z) - Math.hypot(b[0] - g.x, b[2] - g.z))[0]
      if (target) {
        tmp.set(...target).sub(g)
        if (Math.abs(tmp.x) > 0.05) facing.current = Math.sign(tmp.x)
        if (tmp.length() > 0.1) g.addScaledVector(tmp.normalize(), Math.min(6 * dt, tmp.length()))
      } else {
        // Pánico: correr en círculos (donde se quemó, o en el punto de la pregunta)
        const a = failedOption?.burn ? burnAt.current : anchor.current
        g.set(a.x + Math.cos(t * 9) * 0.9, a.y, a.z + Math.sin(t * 9) * 0.9)
        facing.current = Math.sin(t * 9) > 0 ? -1 : 1
      }
      lift = Math.abs(Math.sin(t * 24)) * 0.2
    } else if (phase === 'won') {
      frame = frameAt('jump', ms)
      if (frame === 5) lift = 0.45 // en el aire
    }

    // Sonidos sincronizados con la animación: pasos al apoyar el pie y "boing" al despegar
    if (frame !== lastFrame.current) {
      if (phase === 'walking' && (dir.x || dir.z) && (frame === 0 || frame === 2)) sound.sfx.step()
      if (phase === 'won' && frame === 5) sound.sfx.jump()
      lastFrame.current = frame
    }
    texture.offset.x = frame / FRAME_COUNT
    // acostado, el sprite queda de lado: su centro baja a la mitad de su ancho
    bobber.current.position.y = THREE.MathUtils.lerp(AVATAR_HEIGHT / 2, width / 2, tilt / (Math.PI / 2)) + lift
    sprite.current.rotation.z = tilt
    sprite.current.scale.x = facing.current
    positionRef.current.copy(g)
  })

  return (
    <group ref={group}>
      <group ref={bobber} position-y={AVATAR_HEIGHT / 2}>
        <Billboard>
          <mesh ref={sprite}>
            <planeGeometry args={[width, AVATAR_HEIGHT]} />
            <meshBasicMaterial map={texture} transparent alphaTest={0.5} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      </group>
      {/* Sombra blob */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <circleGeometry args={[0.5, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
