import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CALM_MS, WAKE_MS, useEmergency, useGameStore } from '../../store/useGameStore'
import { BURNING, FRAME_COUNT, SQUASHED, frameAt, getCharacter } from '../../data/characters'
import { pixelateTexture } from '../../utils/pixelTextures'
import { LEVEL, SPOTS, nav, routeStart, stepReached, touchesHazard } from './basementLayout'
import { buildGraph, routeBetween } from './corridorGraph'
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
 * - failing  → pánico: camina muy rápido hacia `failTarget` o en círculos; si le cayó un pedazo de techo,
 *               queda aplastado en el piso (SQUASHED); si tocó el fuego o el gas, se queda ahí quemándose o
 *               ahogándose (BURNING)
 * - won      → animación "jump" en loop
 *
 * Los sprites miran a la derecha: al moverse hacia -X se espejan (scale.x = -1).
 */

const AVATAR_HEIGHT = 1.7
const HOP = 0.12 // salto extra (unidades) en los fotogramas altos de la caminata
const ASLEEP_MS = 1400 // al sonar la alarma sigue acostado (temblando) este tiempo antes de levantarse
const tmp = new THREE.Vector3()
const CHARRED = new THREE.Color('#3a2a22') // quemado
const CHOKE = new THREE.Color('#7dff8a') // ahogado por el gas
const WHITE = new THREE.Color('#ffffff')
const dir = { x: 0, z: 0 }

export default function Avatar({ positionRef }) {
  const group = useRef(null)
  const bobber = useRef(null)
  const sprite = useRef(null)
  const shadow = useRef(null)
  const squashed = useRef(null) // aplastado en el piso (le cayó un pedazo de techo)
  const burning = useRef(null) // quemándose (fuego) o ahogándose (gas)
  const deathAt = useRef(0) // cuándo empezó a quemarse / ahogarse (para ennegrecerlo de a poco)
  const failRoute = useRef(null) // camino por los pasillos al correr en pánico hacia failTarget

  const character = getCharacter(useGameStore((s) => s.selectedCharacter))
  const baseTexture = useTexture(character.sheet)
  const texture = useMemo(() => {
    const t = pixelateTexture(baseTexture.clone())
    t.repeat.set(1 / FRAME_COUNT, 1)
    return t
  }, [baseTexture])
  const width = (AVATAR_HEIGHT * character.frameW) / character.frameH
  const squashedBase = useTexture(SQUASHED.sheet)
  const squashedTexture = useMemo(() => {
    const t = pixelateTexture(squashedBase.clone())
    t.repeat.set(1 / SQUASHED.frames, 1)
    t.offset.x = character.squashed / SQUASHED.frames
    return t
  }, [squashedBase, character])
  const burningBase = useTexture(BURNING.sheet)
  const burningTexture = useMemo(() => {
    const t = pixelateTexture(burningBase.clone())
    t.repeat.set(1 / BURNING.frames, 1 / BURNING.rows)
    t.offset.y = 1 - (character.burning + 1) / BURNING.rows
    return t
  }, [burningBase, character])
  const burningSize = [(BURNING.frameW * AVATAR_HEIGHT) / character.frameH, (BURNING.frameH * AVATAR_HEIGHT) / character.frameH]
  // a la misma escala de píxel que el personaje
  const squashedSize = [(SQUASHED.frameW * AVATAR_HEIGHT) / character.frameH, (SQUASHED.frameH * AVATAR_HEIGHT) / character.frameH]

  const runId = useGameStore((s) => s.runId)
  const attempts = useGameStore((s) => s.attempts)
  const emergency = useEmergency()
  const start = routeStart(emergency)
  const lying = !!emergency?.route?.lying
  const bed = emergency?.route?.lyingOn ? SPOTS[emergency.route.lyingOn] : null // mueble donde está acostado
  const calm = !!emergency?.route?.calm
  const seated = !!emergency?.route?.seated

  const anchor = useRef(new THREE.Vector3(...start)) // último punto de control alcanzado
  const wakeAt = useRef(-1) // momento (s) en que empezó a despertarse
  const burnAt = useRef(new THREE.Vector3()) // dónde tocó el fuego / el gas (ahí se queda)
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
    const { phase, failedOption, arriveAt, attempts: tries } = useGameStore.getState()
    const g = group.current.position
    let frame = 0
    let lift = 0
    let tilt = 0 // giro del sprite: π/2 = acostado
    let onBed = 0 // 1 = encima del mueble (route.lyingOn), 0 = en su punto del piso

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
      onBed = bed && woke <= WAKE_MS ? 1 - getUp : 0 // al levantarse salta del mueble al piso
    } else if (seated && (phase === 'intro' || phase === 'waking')) {
      // Sentado estudiando en la silla, mirando a la mesa (al oeste); al oler el gas se pone de pie asustado y
      // mira a los lados
      if (phase === 'waking' && wakeAt.current < 0) wakeAt.current = t
      const since = phase === 'waking' ? (t - wakeAt.current) * 1000 : 0
      facing.current = -1
      if (since > ASLEEP_MS) {
        frame = frameAt('panic', ms)
        lift = Math.abs(Math.sin(since / 70)) * 0.05
        facing.current = Math.sin(since / 220) > 0 ? 1 : -1
      } else lift = -0.35 // sentado: más bajo, la silla y la mesa le tapan las piernas
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
      if (failedOption?.id === 'debris') {
        // le cayó un pedazo de techo: queda aplastado donde estaba (no corre)
      } else if (failedOption?.id === 'fire' || failedOption?.id === 'gas') {
        // tocó el fuego o el gas: se queda donde lo tocó, quemándose / ahogándose (ver abajo)
        g.copy(burnAt.current)
      } else if (target) {
        // corre hacia allá por los pasillos (nunca en línea recta por el vacío ni subiendo la rampa)
        const key = `${tries}|${failedOption.id}`
        if (failRoute.current?.key !== key) {
          const level = g.y > LEVEL.s1 / 2 ? 's1' : 's2'
          const clear = ([ax, az], [bx, bz]) => nav.move(ax, g.y, az, bx, bz) !== null
          const ends = [[g.x, g.z], [target[0], target[2]]]
          // afuera (campus) no hay pasillos: va directo
          const pts = useGameStore.getState().isOutside
            ? ends
            : (routeBetween(buildGraph(level, emergency.hazard), ...ends, clear) ??
              routeBetween(buildGraph(level, null), ...ends, clear) ??
              ends)
          failRoute.current = { key, pts, seg: 0 }
        }
        const route = failRoute.current
        let left = 6 * dt
        while (left > 0 && route.seg < route.pts.length - 1) {
          const [tx, tz] = route.pts[route.seg + 1]
          const dx = tx - g.x
          const dz = tz - g.z
          const d = Math.hypot(dx, dz)
          if (d < 0.15) {
            route.seg++
            continue
          }
          if (Math.abs(dx) > 0.05) facing.current = Math.sign(dx)
          const s = Math.min(left, d)
          const nx = g.x + (dx / d) * s
          const nz = g.z + (dz / d) * s
          // por si acaso, choca con los muros y se desliza como al caminar
          let y = nav.move(g.x, g.y, g.z, nx, nz)
          if (y !== null) g.set(nx, y, nz)
          else if ((y = nav.move(g.x, g.y, g.z, nx, g.z)) !== null) g.set(nx, y, g.z)
          else if ((y = nav.move(g.x, g.y, g.z, g.x, nz)) !== null) g.set(g.x, y, nz)
          else route.seg++ // atascado: sigue con el siguiente tramo
          left -= s
        }
      } else {
        // Pánico: correr en círculos (donde se quemó, o en el punto de la pregunta)
        const a = failedOption?.burn ? burnAt.current : anchor.current
        g.set(a.x + Math.cos(t * 9) * 0.9, a.y, a.z + Math.sin(t * 9) * 0.9)
        facing.current = Math.sin(t * 9) > 0 ? -1 : 1
      }
      if (!['debris', 'fire', 'gas'].includes(failedOption?.id)) lift = Math.abs(Math.sin(t * 24)) * 0.2
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
    // acostado en un mueble: el sprite y la sombra se corren encima de él (el punto de navegación sigue en el piso)
    const bx = bed ? (bed[0] - g.x) * onBed : 0
    const bz = bed ? (bed[2] - g.z) * onBed : 0
    const by = bed ? (bed[1] - g.y) * onBed : 0
    bobber.current.position.x = bx
    bobber.current.position.z = bz
    bobber.current.position.y += by
    shadow.current.position.set(bx, 0.03 + by, bz)
    // aplastado: en vez del personaje se ve su sprite aplastado sobre el piso
    const flat = (phase === 'failing' || phase === 'failed') && failedOption?.id === 'debris'
    bobber.current.visible = shadow.current.visible = !flat
    squashed.current.visible = flat
    // se quema / se ahoga vivo: sus fotogramas agitando los brazos, en loop rápido, con un tinte encima
    const dying = (phase === 'failing' || phase === 'failed') && (failedOption?.id === 'fire' || failedOption?.id === 'gas')
    sprite.current.visible = !dying
    burning.current.visible = dying
    if (dying) {
      const step = Math.floor(ms / BURNING.frameMs) % BURNING.loop.length
      burningTexture.offset.x = (phase === 'failed' ? 0 : BURNING.loop[step]) / BURNING.frames
      burning.current.scale.x = facing.current
      const mat = burning.current.material
      if (failedOption.id === 'fire') {
        // fuego: parpadea entre naranja y amarillo y se va ennegreciendo
        const flick = 0.5 + 0.5 * Math.sin(ms / 45)
        mat.color.setRGB(1, 0.45 + 0.35 * flick, 0.15 + 0.2 * flick).lerp(CHARRED, Math.min(1, (t - deathAt.current) / 2.4))
      } else {
        // gas: se pone verde y pálido mientras se ahoga, temblando
        mat.color.copy(CHOKE).lerp(WHITE, 0.25 + 0.25 * Math.sin(ms / 120))
        burning.current.position.x = Math.sin(ms / 30) * 0.03
      }
    } else deathAt.current = t
    sprite.current.rotation.z = tilt
    sprite.current.scale.x = facing.current
    positionRef.current.copy(g)
  })

  return (
    <group ref={group}>
      <group ref={bobber} position-y={AVATAR_HEIGHT / 2}>
        <Billboard>
          <mesh ref={burning} visible={false} position-y={burningSize[1] / 2 - AVATAR_HEIGHT / 2}>
            <planeGeometry args={burningSize} />
            <meshBasicMaterial map={burningTexture} transparent alphaTest={0.5} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={sprite}>
            <planeGeometry args={[width, AVATAR_HEIGHT]} />
            <meshBasicMaterial map={texture} transparent alphaTest={0.5} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      </group>
      {/* Aplastado (terremoto): plano sobre el piso, con la parte de arriba del dibujo hacia el fondo (−z) */}
      <mesh ref={squashed} rotation-x={-Math.PI / 2} position-y={0.04} visible={false}>
        <planeGeometry args={squashedSize} />
        <meshBasicMaterial map={squashedTexture} transparent alphaTest={0.5} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Sombra blob */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.03}>
        <circleGeometry args={[0.5, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
