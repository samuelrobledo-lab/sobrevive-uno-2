import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { EMERGENCIES } from '../data/emergencies'
import { sound } from './sound'

const MENU_SCREENS = ['home', 'character', 'select']

/**
 * Traduce los cambios del estado del juego en música, ambiente y efectos.
 * Se monta una sola vez en App.
 */
export function useSoundDirector() {
  useEffect(() => {
    // El audio solo puede arrancar tras un gesto del usuario; cada clic en un botón suena.
    const onGesture = (e) => {
      sound.unlock()
      if (e.type === 'pointerdown' && e.target.closest?.('button')) sound.sfx.click()
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)

    const apply = (s, prev = {}) => {
      if (s.screen !== prev.screen) {
        sound.music(MENU_SCREENS.includes(s.screen))
        if (s.screen !== 'simulator') sound.ambient(null)
      }
      if (s.screen !== 'simulator') return
      const hazard = s.selectedEmergency && EMERGENCIES[s.selectedEmergency].hazard

      // (el terremoto de ruta tranquila suena solo cuando empieza a temblar)
      if (s.runId !== prev.runId || (s.phase === 'intro' && prev.phase !== 'intro')) sound.ambient(s.tremor ? hazard : null)
      if (s.tremor && !prev.tremor) sound.ambient(hazard)
      // Terremoto: la tierra suena y caen cosas hasta que el personaje sale de los sótanos
      if (hazard === 'quake' && s.isOutside && !prev.isOutside) sound.endQuake()

      if (s.phase === prev.phase) return
      if (s.phase === 'deciding') sound.sfx.decision()
      if (s.phase === 'walking' && prev.phase === 'deciding') sound.sfx.correct()
      if (s.phase === 'failing') {
        sound.sfx.wrong()
        sound.sfx.chaos(hazard)
      }
      if (s.phase === 'won') {
        sound.ambient(null)
        sound.sfx.victory()
      }
    }

    apply(useGameStore.getState())
    const unsub = useGameStore.subscribe(apply)
    return () => {
      unsub()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])
}
