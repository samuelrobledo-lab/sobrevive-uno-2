import { lazy, Suspense } from 'react'
import { useGameStore } from './store/useGameStore'
import CampusStage from './views/CampusStage'
import Landing from './views/Landing'
import CharacterSelect from './views/CharacterSelect'
import EmergencySelect from './views/EmergencySelect'
import { useSoundDirector } from './audio/useSoundDirector'

// El simulador se descarga aparte, solo cuando se usa (la portada carga más rápido)
const SimulatorView = lazy(() => import('./views/SimulatorView'))

/**
 * Componente raíz: enruta por `screen` del store.
 *
 * PORTADA (scroll): intro → mapa 3D (pins → fichas) → comenzar
 *   └─ character → select → simulator (intro → 3 decisiones → éxito / error+reintentar)
 */
export default function App() {
  const screen = useGameStore((s) => s.screen)
  useSoundDirector()
  // Una sola escena 3D del campus de fondo para la portada y las pantallas de selección
  const showStage = screen !== 'simulator'

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-carbon-950 text-white select-none">
      {showStage && <CampusStage />}
      {screen === 'home' && <Landing />}
      {screen === 'character' && <CharacterSelect />}
      {screen === 'select' && <EmergencySelect />}
      {screen === 'simulator' && (
        <Suspense fallback={null}>
          <SimulatorView />
        </Suspense>
      )}
    </main>
  )
}
