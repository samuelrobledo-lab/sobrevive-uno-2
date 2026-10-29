import { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, useEmergency } from '../store/useGameStore'
import { PIXEL_DPR } from '../config'
import SotanosModel from '../components/three/SotanosModel'
import Avatar from '../components/three/Avatar'
import HazardEffects from '../components/three/HazardEffects'
import CameraRig from '../components/three/CameraRig'
import { SPOTS, routeStart } from '../components/three/basementLayout'
import CheckpointBeacon from '../components/three/CheckpointBeacon'
import OutsideLabs from '../components/three/OutsideLabs'
import StudyDesk from '../components/three/StudyDesk'
import { useKeyboardMovement } from '../utils/playerInput'
import ReadySignal from '../components/three/ReadySignal'
import { LoadingScreen } from '../components/ui/primitives'
import {
  SimHUD,
  StoryModal,
  DecisionModal,
  ChaosOverlay,
  FeedbackModal,
  VictoryModal,
  SuccessToast,
  MoveControls,
} from '../components/ui/SimulatorOverlays'

/** Ambientación por amenaza: fondo, niebla y tono de luz. */
const THEME = {
  fire: { bg: '#1a1012', fog: '#2a1a1a', sky: '#ffb08a', ground: '#3a1a12', fogFar: 34 },
  gas: { bg: '#0f1712', fog: '#1d3322', sky: '#c8ffbf', ground: '#10241a', fogFar: 38 },
  quake: { bg: '#16130f', fog: '#2c2620', sky: '#ffe6c4', ground: '#2a2218', fogFar: 42 },
}

/** Afuera de labs: cielo de día y niebla clara. */
const OUTSIDE = { bg: '#a9d6ef', fog: '#cfe7f2', sky: '#fff7e6', ground: '#7f9a68', fogFar: 70 }

/**
 * Módulo 1 — Escena 3D del simulador + capas de UI según la fase del juego.
 * El usuario mueve al personaje libremente; las preguntas aparecen al llegar a cada punto de control.
 */
export default function SimulatorView() {
  const emergency = useEmergency()
  const phase = useGameStore((s) => s.phase)
  const fading = useGameStore((s) => s.fading)
  // afuera de labs (después de la transición): ya es de día
  const outside = useGameStore((s) => s.isOutside && s.teleport.to)
  const avatarPos = useRef(new THREE.Vector3(...routeStart(emergency)))
  const [ready, setReady] = useState(false)
  useKeyboardMovement()
  if (!emergency) return null
  const theme = outside ? OUTSIDE : THEME[emergency.hazard]

  return (
    <section className="relative h-full w-full overflow-hidden" aria-label={`Simulación: ${emergency.name}`}>
      <div className={`absolute inset-0 ${phase === 'failing' ? 'anim-shake' : ''}`}>
        <Canvas dpr={PIXEL_DPR.simulator} camera={{ fov: 45, position: [-19, 9, 13] }} gl={{ antialias: true }}>
          <color attach="background" args={[theme.bg]} />
          <fog attach="fog" args={[theme.fog, 12, theme.fogFar]} />
          <hemisphereLight args={[theme.sky, theme.ground, 1.5]} />
          <directionalLight position={[8, 20, 10]} intensity={1.2} />
          <Suspense fallback={null}>
            <SotanosModel avatarRef={avatarPos} />
            <Avatar positionRef={avatarPos} />
            <CheckpointBeacon avatarRef={avatarPos} />
            <HazardEffects hazard={emergency.hazard} avatarRef={avatarPos} />
            {outside && <OutsideLabs />}
            {emergency.route?.seated && <StudyDesk position={SPOTS[emergency.route.start]} />}
          </Suspense>
          <CameraRig targetRef={avatarPos} hazard={emergency.hazard} />
          <ReadySignal onReady={() => setReady(true)} />
        </Canvas>
      </div>

      {/* Transición: pantalla en negro mientras el personaje sale de los sótanos */}
      <div
        className={`pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-700 ${fading ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      {!ready && <LoadingScreen label="Preparando los sótanos" />}
      <SimHUD />
      {phase === 'intro' && <StoryModal />}
      {phase === 'deciding' && <DecisionModal />}
      {phase === 'failing' && <ChaosOverlay />}
      {phase === 'failed' && <FeedbackModal />}
      {phase === 'won' && <VictoryModal />}
      {phase === 'walking' && <SuccessToast />}
      {phase === 'walking' && <MoveControls />}
    </section>
  )
}
