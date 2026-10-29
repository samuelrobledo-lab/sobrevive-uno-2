import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import { SECTION, landing } from '../store/landingProgress'
import { ZONES } from '../data/zones'
import Hotspot from '../components/three/Hotspot'
import InfoCard from '../components/ui/InfoCard'
import { GlassPanel, IconButton, PixelButton, SoundToggle } from '../components/ui/primitives'

/** Vista general 3D de la cámara. */
// centrada en todo el campus, incluido el parqueadero del costado norte
const OVERVIEW = { position: new THREE.Vector3(7, 52, 58), target: new THREE.Vector3(1, 0, -5), fov: 40 }

/** Vista general ajustada al formato: más lejos en pantallas angostas para que quepa todo el campus. */
export function mapKey(aspect) {
  const k = THREE.MathUtils.clamp(1.85 / aspect, 1, 2.6)
  const position = OVERVIEW.position.clone().sub(OVERVIEW.target).multiplyScalar(k).add(OVERVIEW.target)
  return { position, target: OVERVIEW.target.clone(), fov: OVERVIEW.fov }
}

/** Cámara y controles de la escena compartida (los usan los botones de zoom). */
export const mapView = { camera: null, controls: null }
/** Animación de enfoque en curso (se cancela si el usuario sale del mapa a mitad de camino). */
export const focus = { tween: null }

// La guía de controles se muestra solo la primera vez que se entra al mapa en la sesión
let guideSeen = false

/**
 * Módulo 2 — Mapa 3D interactivo (última sección de la portada, después de la experiencia).
 * La escena 3D es la de <CampusStage/> (compartida con toda la portada); aquí van:
 *   MapScene → pins + enfoque de cámara (dentro del canvas)
 *   MapView  → barra superior, ficha del lugar y guía de controles (DOM)
 * La rueda del mouse cambia de sección en la portada, así que el zoom va con los botones + / −.
 */
export default function MapView() {
  const { selectedZone, goHome } = useGameStore()
  const atMap = useGameStore((s) => s.screen === 'home' && s.landingSection === SECTION.map)
  const [showGuide, setShowGuide] = useState(!guideSeen)
  const closeGuide = () => {
    guideSeen = true
    setShowGuide(false)
  }

  return (
    <section className="pointer-events-none relative h-full w-full overflow-hidden" aria-label="Mapa 3D interactivo">
      {/* Barra superior */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-end gap-3 p-3 sm:justify-between sm:p-4">
        <GlassPanel large={false} className="pointer-events-auto hidden px-4 py-3 sm:block">
          <p className="font-pixel text-[0.55rem] text-white/70 uppercase">Módulo 2</p>
          <h1 className="font-pixel text-[0.75rem] leading-relaxed">Mapa 3D · UAO</h1>
        </GlassPanel>
        <div className="pointer-events-auto flex gap-2">
          <IconButton icon="plus" label="Acercar" onClick={() => zoomBy(mapView, 0.65)} />
          <IconButton icon="minus" label="Alejar" onClick={() => zoomBy(mapView, 1.55)} />
          <SoundToggle />
          <IconButton icon="help" label="Cómo moverte en el mapa" onClick={() => setShowGuide(true)} />
          <IconButton icon="home" label="Volver al inicio" onClick={goHome} />
        </div>
      </header>

      <div className="pointer-events-auto">
        <InfoCard />
      </div>
      {atMap && showGuide && <ControlsGuide onClose={closeGuide} />}
    </section>
  )
}

/** Pins del mapa: crecen al acercarse a la sección y mantienen la escena animada mientras se ven. */
export function MapScene() {
  const { selectedZone, selectZone } = useGameStore()
  const group = useRef(null)
  useFrame(({ invalidate }) => {
    const s = THREE.MathUtils.clamp(1 - Math.abs(landing.pos - SECTION.map) * 1.6, 0, 1)
    group.current.scale.setScalar(Math.max(1e-3, s * s * (3 - 2 * s)))
    invalidate()
  })
  return (
    <>
      <group ref={group}>
        {ZONES.map((z, i) => (
          <Hotspot key={z.id} zone={z} index={i} active={selectedZone === z.id} onSelect={selectZone} />
        ))}
      </group>
      <CameraFocus selectedZone={selectedZone} />
    </>
  )
}

/**
 * Anima cámara y target de OrbitControls hacia la zona seleccionada (o de vuelta a la vista general).
 * En móvil/escritorio desplaza el punto de mira para que el pin no quede tapado por la ficha.
 */
function CameraFocus({ selectedZone }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const prev = useRef(selectedZone)

  useEffect(() => {
    const was = prev.current
    prev.current = selectedZone
    if (!controls || (was == null && selectedZone == null)) return
    if (landing.settled !== SECTION.map || Math.abs(landing.pos - SECTION.map) > 1e-3) return // fuera del mapa la cámara sigue al scroll
    const zone = ZONES.find((z) => z.id === selectedZone)
    let target
    let position
    if (zone) {
      const mobile = size.width < 640
      const [x, y, z] = zone.position
      const k = size.width / size.height < 1 ? 1.5 : 1
      const [ox, oy, oz] = zone.cameraOffset.map((v) => v * k)
      // Empuja el foco para dejar el pin visible junto a la ficha (arriba en móvil; a la izquierda en escritorio,
      // donde la ficha ocupa la derecha). El empuje crece con la distancia de la cámara.
      const dist = Math.hypot(ox, oy, oz)
      const nudge = mobile ? [0, -1.5, 3] : [dist * 0.2, 0, 0]
      target = [x + nudge[0], y + 1.5 + nudge[1], z + nudge[2]]
      position = [x + ox + nudge[0], y + oy, z + oz + nudge[2]]
    } else {
      const key = mapKey(size.width / size.height)
      target = key.target.toArray()
      position = key.position.toArray()
    }

    focus.tween?.kill()
    const tl = gsap.timeline({ defaults: { duration: 1.3, ease: 'power3.inOut' }, onUpdate: () => controls.update() })
    tl.to(camera.position, { x: position[0], y: position[1], z: position[2] }, 0)
    tl.to(controls.target, { x: target[0], y: target[1], z: target[2] }, 0)
    focus.tween = tl
  }, [selectedZone, controls, camera, size.width, size.height])

  return null
}

/**
 * Acerca (factor < 1) o aleja (> 1) la cámara respecto al punto que mira, con animación.
 * Los clics seguidos se suman: cada uno parte de la distancia a la que iba el anterior (no de la mitad del camino).
 */
const zoom = { tween: null, dist: 0 }
function zoomBy({ camera, controls }, factor) {
  if (!camera || !controls) return
  focus.tween?.kill() // si la cámara venía volando hacia un pin, el zoom manda
  const offset = camera.position.clone().sub(controls.target)
  const from = zoom.tween?.isActive() ? zoom.dist : offset.length()
  zoom.dist = THREE.MathUtils.clamp(from * factor, controls.minDistance, controls.maxDistance)
  const to = controls.target.clone().add(offset.setLength(zoom.dist))
  zoom.tween?.kill()
  zoom.tween = gsap.to(camera.position, {
    x: to.x,
    y: to.y,
    z: to.z,
    duration: 0.45,
    ease: 'power2.out',
    onUpdate: () => controls.update(),
  })
}

/** Instrucciones de navegación (mouse o táctil según el dispositivo). */
const GUIDE = {
  mouse: [
    ['Arrastrar con clic izquierdo', 'Girar alrededor del campus'],
    ['Botones + / −', 'Acercar / alejar'],
    ['Arrastrar con clic derecho', 'Desplazar la vista'],
    ['Clic en un pin', 'Ver la ficha del lugar'],
    ['Rueda del mouse', 'Volver a las secciones anteriores'],
  ],
  touch: [
    ['Arrastrar con 1 dedo', 'Girar alrededor del campus'],
    ['Botones + / −', 'Acercar / alejar'],
    ['Arrastrar con 2 dedos', 'Desplazar la vista'],
    ['Tocar un pin', 'Ver la ficha del lugar'],
    ['Puntos de la izquierda', 'Volver a las secciones anteriores'],
  ],
}

function ControlsGuide({ onClose }) {
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const steps = GUIDE[touch ? 'touch' : 'mouse']

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-carbon-950/55 p-4"
    >
      <GlassPanel className="anim-pop w-full max-w-md p-6 sm:p-8">
        <p className="font-pixel text-[0.55rem] text-signal-amber uppercase">Antes de empezar</p>
        <h2 id="guide-title" className="mt-2 font-pixel text-sm leading-relaxed sm:text-base">
          Cómo moverte en el mapa
        </h2>
        <ul className="mt-5 space-y-3">
          {steps.map(([gesture, action]) => (
            <li key={gesture} className="flex items-center gap-3">
              <span className="pixel-corners shrink-0 bg-white/15 px-2.5 py-2 text-[0.95rem] font-semibold sm:w-56">
                {gesture}
              </span>
              <span className="text-[1.02rem] text-white/90">{action}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end">
          <PixelButton onClick={onClose} autoFocus>
            Explorar
          </PixelButton>
        </div>
      </GlassPanel>
    </div>
  )
}
