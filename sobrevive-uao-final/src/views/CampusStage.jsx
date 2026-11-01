import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import { SECTION, landing, onLandingChange } from '../store/landingProgress'
import { PIXEL_DPR } from '../config'
import UaoCampus from '../components/three/UaoCampus'
import ReadySignal from '../components/three/ReadySignal'
import { HAZE, PixelSky, mixHex } from '../components/three/pixelSky'
import { MapScene, focus, mapKey, mapView } from './MapView'
import { spriteToTexture } from '../utils/sprites'
import { LoadingScreen } from '../components/ui/primitives'
import { campusStage } from '../utils/campusSnapshot'

/**
 * Escena 3D única de la portada (y fondo de la selección de personaje / emergencia).
 *
 * Una sola cámara recorre el campus siguiendo el scroll, sin cortes entre secciones:
 *   0 · Amanecer: frente a la explanada, mirando el lado trasero del Edificio Principal
 *   1 · Experiencia (comenzar): la cámara rodea el Edificio Principal por el sur hasta quedar frente al patio
 *   2 · Mapa 3D: sube a la vista aérea del campus (aquí la cámara se puede girar y los pins se pueden tocar)
 * Mientras tanto el cielo pasa del amanecer a un día soleado (el sol siempre queda atrás).
 *
 * Optimización: un solo contexto WebGL y un solo campus para toda la portada; se dibuja "bajo demanda"
 * (solo cuando la cámara o algo de la escena cambia), salvo en el mapa, donde los pins están animados.
 */

const EYE = new THREE.Vector3(-48, 6.5, 0)
const PLATFORM_EDGE_X = -36.5 // el borde inferior de la pantalla cae en el borde de la plataforma (sin pasto delante)
const PLATFORM_TOP_Y = 2.89
const SUN_ELEVATION = Math.atan((14 - EYE.y) / (-18 - EYE.x)) // el sol asoma justo sobre el techo
const START = { position: new THREE.Vector3(6, 9, 0.3), target: new THREE.Vector3(-16, 7.5, 0), hfov: THREE.MathUtils.degToRad(64), minFov: 55 }

/** 0 · Amanecer: encuadre ajustado al formato de pantalla (las dos alas caben, sin suelo delante). */
function introKey(aspect) {
  const hfov = THREE.MathUtils.degToRad(60)
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)), 48, 64)
  const down = Math.atan((EYE.y - PLATFORM_TOP_Y) / (PLATFORM_EDGE_X - EYE.x))
  const pitch = THREE.MathUtils.degToRad(fov / 2) - down
  const target = new THREE.Vector3(EYE.x + 30, EYE.y + Math.tan(pitch) * 30, 0)
  // fila de la pantalla (0 arriba – 1 abajo) donde queda el sol
  const sunRow = 0.5 - (0.5 * Math.tan(SUN_ELEVATION - pitch)) / Math.tan(THREE.MathUtils.degToRad(fov / 2))
  return { position: EYE.clone(), target, fov, sunRow }
}

/** 1 · Experiencia: frente al patio del Edificio Principal, con el sol detrás del techo en arco. */
function startKey(aspect) {
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(START.hfov / 2) / aspect)), START.minFov, 80)
  return { position: START.position.clone(), target: START.target.clone(), fov }
}

const smooth = (t) => t * t * (3 - 2 * t)
const lerp = THREE.MathUtils.lerp

/** Eje del Edificio Principal: del amanecer a la experiencia la cámara lo rodea en arco (no lo atraviesa). */
const ORBIT_CENTER = new THREE.Vector3(-17, 0, 0)
const ORBIT_LIFT = 6 // sube un poco a mitad del arco para pasar sobre los edificios del sur
const rel = new THREE.Vector3()

/** Ángulo (0–2π) y radio de una posición alrededor del eje del Edificio Principal. */
function polar(position) {
  rel.subVectors(position, ORBIT_CENTER)
  return [(Math.atan2(rel.z, rel.x) + Math.PI * 2) % (Math.PI * 2), Math.hypot(rel.x, rel.z)]
}

/**
 * Posición en arco alrededor del Edificio Principal entre las vistas a y b.
 * Del amanecer (ángulo π, al oeste) a la experiencia (≈ 0, al este) pasa por π/2: el lado sur (z > 0).
 */
function orbitPosition(a, b, t, out) {
  const [angA, ra] = polar(a.position)
  const [angB, rb] = polar(b.position)
  const ang = lerp(angA, angB, t)
  const r = lerp(ra, rb, t)
  return out.set(
    ORBIT_CENTER.x + Math.cos(ang) * r,
    lerp(a.position.y, b.position.y, t) + Math.sin(Math.PI * t) * ORBIT_LIFT,
    ORBIT_CENTER.z + Math.sin(ang) * r,
  )
}

/** Niebla por sección (amanecer, experiencia, mapa). */
const FOG = { near: [70, 90, 120], far: [160, 220, 260] }

/** Mueve cámara, cielo, niebla y luces según la posición del scroll. */
function StageRig() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const sky = useMemo(() => new PixelSky(), [])
  const hemi = useRef(null)
  const sun = useRef(null)
  const live = useRef(null) // cámara del mapa tal como la dejó el usuario (para salir de ahí sin saltos)
  const look = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    scene.fog = new THREE.Fog(HAZE[0], 70, 160)
    return () => {
      scene.fog = null
      sky.texture?.dispose()
    }
  }, [scene, sky])
  useEffect(() => onLandingChange(invalidate), [invalidate])
  useEffect(() => useGameStore.subscribe(() => invalidate()), [invalidate])

  useFrame(() => {
    const home = useGameStore.getState().screen === 'home'
    const p = home ? landing.pos : SECTION.start // selección de personaje / emergencia: vista de la experiencia
    const aspect = size.width / size.height
    const atMap = home && landing.settled === SECTION.map && Math.abs(p - SECTION.map) < 1e-3

    // --- Cámara ---
    if (controls) controls.enabled = atMap
    const intro = introKey(aspect)
    if (atMap) {
      live.current = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }
    } else {
      focus.tween?.kill()
      if (Math.abs(p - SECTION.map) >= 0.999) live.current = null
      const keys = [intro, startKey(aspect), live.current ?? mapKey(aspect)] // en el orden de SECTION
      const seg = Math.min(1, Math.floor(p))
      const t = smooth(THREE.MathUtils.clamp(p - seg, 0, 1))
      const a = keys[seg]
      const b = keys[seg + 1]
      if (seg === SECTION.intro) {
        orbitPosition(a, b, t, camera.position) // rodea el Edificio Principal
      } else {
        // al subir al mapa la cámara se eleva primero (así no roza los edificios)
        const ty = Math.sqrt(t)
        camera.position.set(lerp(a.position.x, b.position.x, t), lerp(a.position.y, b.position.y, ty), lerp(a.position.z, b.position.z, t))
      }
      look.lerpVectors(a.target, b.target, t)
      camera.lookAt(look)
      controls?.target.copy(look)
      const fov = lerp(a.fov, b.fov, t)
      if (camera.fov !== fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    }

    // --- Cielo, niebla y luces: del amanecer (p = 0) al día (p ≥ 1) ---
    const day = smooth(THREE.MathUtils.clamp(p, 0, 1))
    scene.background = sky.paint(day, aspect, intro.sunRow)
    scene.fog.color.set(mixHex(HAZE[0], HAZE[1], day))
    const fs = Math.min(1, Math.floor(p))
    scene.fog.near = lerp(FOG.near[fs], FOG.near[fs + 1], p - fs)
    scene.fog.far = lerp(FOG.far[fs], FOG.far[fs + 1], p - fs)
    hemi.current.color.set(mixHex('#ffdcb8', '#f3f1e4', day))
    hemi.current.groundColor.set(mixHex('#7d7a5c', '#8f9a6e', day))
    hemi.current.intensity = lerp(1.45, 1.75, day)
    sun.current.color.set(mixHex('#ffc896', '#ffe9b8', day))
    sun.current.intensity = lerp(2.2, 2.3, day)
    sun.current.position.set(lerp(-40, 30, day), lerp(14, 22, day), lerp(22, 18, day))
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
    </>
  )
}

/* Palmera pixel art (tronco + hojas), tonos apagados */
const PALM = [
  '.....kkk...kkk......',
  '...kkLLLk.kLLLkk....',
  '..kLLGGGLkLGGGLLk...',
  '.kLGGkkkGLGkkkGGLk..',
  'kLGk....kGGk...kGLk.',
  'kGk....kGDDGk....kGk',
  'kk....kGDkkDGk....kk',
  '.....kGDk..kDGk.....',
  '....kGDk....kDGk....',
  '....kDk......kDk....',
  '.....k...TT...k.....',
  '.........TT.........',
  '.........TT.........',
  '........TTt.........',
  '........TTt.........',
  '........TTt.........',
  '.........TTt........',
  '.........TTt........',
  '.........TTt........',
  '........TTt.........',
  '........TTt.........',
  '........TTt.........',
  '.........TTt........',
  '.........TTt........',
  '........TTTt........',
  '.......TTTTtt.......',
]
const PALM_PALETTE = { k: '#3f5338', L: '#9cbf83', G: '#78a064', D: '#5a7d4e', T: '#a08a6c', t: '#7a6750' }

// [x, y, z]: solo sobre la plataforma de la explanada (y 2.89)
const PALMS = [
  [-34.5, 2.89, 5.4],
  [-34.5, 2.89, -5.7],
  [-30.8, 2.89, 9.4],
  [-30.8, 2.89, -9.7],
]

function Palms() {
  const tex = useMemo(() => spriteToTexture(PALM, PALM_PALETTE), [])
  const w = 3.4
  const h = (w * PALM.length) / PALM[0].length
  return PALMS.map(([x, y, z]) => (
    <sprite key={`${x}${z}`} position={[x, y, z]} scale={[w, h, 1]} center={[0.5, 0.02]}>
      <spriteMaterial map={tex} alphaTest={0.5} toneMapped={false} />
    </sprite>
  ))
}

/** Muestra los pins solo cerca de la sección del mapa (re-render solo al cruzar el umbral). */
function useNearMap() {
  const screen = useGameStore((s) => s.screen)
  const [near, setNear] = useState(() => Math.abs(landing.pos - SECTION.map) < 1)
  useEffect(() => onLandingChange(() => setNear(Math.abs(landing.pos - SECTION.map) < 1)), [])
  return screen === 'home' && near
}

export default function CampusStage() {
  const [ready, setReady] = useState(false)
  // la foto de las viñetas de emergencia solo se toma con el campus ya cargado
  useEffect(() => {
    campusStage.ready = ready
    return () => {
      campusStage.ready = false
    }
  }, [ready])
  const nearMap = useNearMap()
  const selectZone = useGameStore((s) => s.selectZone)
  const vignette = useRef(null)

  // Viñeta para leer mejor los textos (no hace falta en el mapa)
  useEffect(() => {
    const update = () => {
      const home = useGameStore.getState().screen === 'home'
      if (vignette.current) vignette.current.style.opacity = String(home ? Math.min(1, Math.abs(landing.pos - SECTION.map)) : 1)
    }
    update()
    const off = onLandingChange(update)
    const unsub = useGameStore.subscribe(update)
    return () => {
      off()
      unsub()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={PIXEL_DPR.home}
        // near 0.5 (no 0.1): más precisión de profundidad y sin parpadeo entre superficies cercanas a lo lejos
        camera={{ position: EYE.toArray(), fov: 50, near: 0.5, far: 800 }}
        gl={{ antialias: true }}
        onPointerMissed={() => selectZone(null)}
      >
        <StageRig />
        <Suspense fallback={null}>
          <UaoCampus />
          <Palms />
          <ReadySignal onReady={() => setReady(true)} />
        </Suspense>
        {nearMap && <MapScene />}
        <OrbitControls
          makeDefault
          enabled={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.15}
          enableZoom={false}
        />
        <ViewBridge />
      </Canvas>
      <div
        ref={vignette}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgb(13_13_16/0.4)_90%)]"
      />
      {!ready && <LoadingScreen label="Cargando campus" />}
    </div>
  )
}

/** Expone cámara y controles al DOM (botones de zoom del mapa) y la escena (foto de las viñetas). */
function ViewBridge() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    mapView.camera = camera
    mapView.controls = controls
  }, [camera, controls])
  useEffect(() => {
    campusStage.gl = gl
    campusStage.scene = scene
    return () => {
      campusStage.gl = campusStage.scene = null
    }
  }, [gl, scene])
  return null
}
