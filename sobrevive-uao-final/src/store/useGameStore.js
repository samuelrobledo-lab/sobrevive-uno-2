import { create } from 'zustand'
import { EMERGENCIES } from '../data/emergencies'
import { CHAOS_DURATION_MS, TOAST_DURATION_MS } from '../config'
import { SECTION } from './landingProgress'

/**
 * Máquina de estados global.
 *
 * screen: 'home' | 'character' | 'select' | 'simulator'
 *   'home' es la portada con secciones (landingSection): 0 intro · 1 experiencia (comenzar) · 2 mapa 3D
 *
 * phase (solo simulador):
 *   intro    → tarjeta "Historia" antes de iniciar
 *   transition → pantalla en negro mientras el personaje pasa a otro lugar (p. ej. sale de los sótanos)
 *   waking   → arranque de la ruta: se despierta con la alarma (route.lying) o camina tranquilo hasta que empieza
 *              a temblar (route.calm); luego sale la 1.ª pregunta
 *   walking  → el avatar camina hacia el siguiente punto de control
 *   deciding → escena pausada, DecisionModal abierto
 *   failing  → secuencia caótica (efectos 3D + overlay)
 *   failed   → FeedbackModal "Te equivocaste por…" (Reintentar / Home)
 *   won      → pantalla "Lo lograste :)"
 *
 * Los flags isPaused / hasFailed / hasWon se derivan de `phase`
 * y se guardan explícitamente para que cualquier componente los lea sin lógica extra.
 */

const PAUSED_PHASES = ['intro', 'deciding', 'failed', 'won', 'transition']

const derive = (phase) => ({
  phase,
  isPaused: PAUSED_PHASES.includes(phase),
  hasFailed: phase === 'failing' || phase === 'failed',
  hasWon: phase === 'won',
})

const simInitial = {
  selectedEmergency: null,
  currentStep: 0, // índice de la decisión actual (0..2); 3 = camino a zona segura
  ...derive('idle'),
  feedbackMessage: null, // feedback de la opción incorrecta elegida
  failedOption: null,
  attempts: 0, // incrementa en cada reintento (reinicia efectos/avatar)
  runId: 0, // incrementa en cada partida nueva (avatar vuelve al inicio)
  mistakes: [], // historial de errores de la partida
  toast: null,
  isOutside: false, // el avatar ya salió de los sótanos (fin del temblor)
  tremor: true, // ya está temblando (en route.calm empieza en false y se activa a los CALM_MS)
  fading: false, // pantalla en negro (transición)
  teleport: { to: null, id: 0 }, // a dónde aparece el personaje tras una transición (clave de SPOTS)
}

/** Transición a negro: tiempo en negro antes de mover al personaje y antes de volver a ver (ms). */
const FADE_MS = 700

/** Cuánto dura el arranque (despertar o caminata tranquila + temblor) antes de la primera pregunta (ms). */
export const WAKE_MS = 3000
/** route.calm: camina tranquilo este tiempo antes de que empiece a temblar (ms). */
export const CALM_MS = 1600

let chaosTimer = null
let toastTimer = null
let wakeTimer = null
let tremorTimer = null
let fadeTimer = null
const clearTimers = () => {
  clearTimeout(fadeTimer)
  clearTimeout(chaosTimer)
  clearTimeout(toastTimer)
  clearTimeout(wakeTimer)
  clearTimeout(tremorTimer)
}

export const useGameStore = create((set, get) => ({
  screen: 'home',
  selectedZone: null, // Módulo 2: id de la zona enfocada
  landingSection: SECTION.intro, // sección visible de la portada (ver SECTION)
  selectedCharacter: 'p1', // se conserva entre partidas (ver data/characters.js)
  ...simInitial,

  /* ---------- Navegación ---------- */
  goTo: (screen) => {
    clearTimers()
    set({ screen, selectedZone: null })
  },
  goHome: () => {
    clearTimers()
    set((s) => ({ ...simInitial, runId: s.runId + 1, screen: 'home', selectedZone: null, landingSection: 0 }))
  },
  /** Ir directo a la sección del mapa en la portada (p. ej. al terminar la experiencia). */
  goToMap: () => {
    clearTimers()
    set((s) => ({ ...simInitial, runId: s.runId + 1, screen: 'home', selectedZone: null, landingSection: SECTION.map }))
  },
  setLandingSection: (n) => set({ landingSection: n, selectedZone: null }),

  /* ---------- Módulo 1: Simulador ---------- */
  selectCharacter: (id) => set({ selectedCharacter: id }),
  setOutside: () => set({ isOutside: true }),

  selectEmergency: (id) => {
    clearTimers()
    set((s) => ({
      ...simInitial,
      selectedEmergency: id,
      runId: s.runId + 1,
      screen: 'simulator',
      tremor: !EMERGENCIES[id].route?.calm,
      ...derive('intro'),
    }))
  },

  /**
   * Cierra la tarjeta de historia y arranca la caminata. Si la primera pregunta es al despertar
   * (`at: 'start'`), primero el avatar se despierta con la alarma y luego sale la pregunta.
   */
  beginRun: () => {
    const { selectedEmergency } = get()
    if (EMERGENCIES[selectedEmergency].decisions[0]?.at !== 'start') return set(derive('walking'))
    set(derive('waking'))
    clearTimeout(wakeTimer)
    wakeTimer = setTimeout(() => get().arriveAt(0), WAKE_MS)
    clearTimeout(tremorTimer)
    if (!get().tremor) tremorTimer = setTimeout(() => set({ tremor: true }), CALM_MS)
  },

  /** Reinicia la emergencia actual desde el principio. */
  restartRun: () => get().selectEmergency(get().selectedEmergency),

  /** Lo llama el avatar al llegar a un punto de control del recorrido. */
  arriveAt: (stop) => {
    if (stop === 'safe') return set({ isOutside: true, ...derive('won') })
    const emergency = EMERGENCIES[get().selectedEmergency]
    // con `transition`: pantalla a negro, el personaje aparece en otro lugar (afuera: termina el temblor) y luego la pregunta
    const to = emergency.decisions[stop]?.transition
    if (to) {
      set({ currentStep: stop, fading: true, ...derive('transition') })
      clearTimeout(fadeTimer)
      fadeTimer = setTimeout(() => {
        set((s) => ({ teleport: { to, id: s.teleport.id + 1 }, isOutside: true }))
        fadeTimer = setTimeout(() => set({ fading: false, ...derive('deciding') }), FADE_MS)
      }, FADE_MS)
      return
    }
    // sin ruta propia, el último punto de control es la salida: ahí termina el temblor
    const routed = !!emergency.route
    set({ currentStep: stop, ...derive('deciding'), ...(stop === 2 && !routed ? { isOutside: true } : {}) })
  },

  /** Resuelve una decisión. */
  choose: (option) => {
    const { selectedEmergency, currentStep } = get()
    const decision = EMERGENCIES[selectedEmergency].decisions[currentStep]

    if (option.correct) {
      const emergency = EMERGENCIES[selectedEmergency]
      // ramas: `next` dice qué pregunta sigue; sin `next`, la siguiente de la lista
      const next = option.next ? emergency.decisions.findIndex((d) => d.id === option.next) : currentStep + 1
      // rutas sin meta: responder bien la última pregunta es llegar
      if (next >= emergency.decisions.length && emergency.route && !emergency.route.goal)
        return set({ currentStep: next, feedbackMessage: null, failedOption: null, toast: null, ...derive('won') })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), TOAST_DURATION_MS)
      return set((s) => ({
        currentStep: next,
        feedbackMessage: null,
        failedOption: null,
        toast: option.successLine ?? decision.successLine ?? '¡Bien hecho!',
        // una opción "arriesgada" sigue la historia pero cuenta como error
        mistakes: option.risky ? [...s.mistakes, { step: currentStep, optionId: option.id }] : s.mistakes,
        ...derive('walking'),
      }))
    }

    set((s) => ({
      failedOption: option,
      feedbackMessage: option.feedback,
      mistakes: [...s.mistakes, { step: currentStep, optionId: option.id }],
      toast: null,
      ...derive('failing'),
    }))
    clearTimeout(chaosTimer)
    chaosTimer = setTimeout(() => set(derive('failed')), CHAOS_DURATION_MS)
  },

  /**
   * El personaje tocó el fuego (se quema) o el gas (se ahoga): secuencia caótica + reflexión, como una mala decisión.
   */
  burn: () => {
    const gas = EMERGENCIES[get().selectedEmergency].hazard === 'gas'
    const option = gas
      ? {
          id: 'gas',
          burn: true,
          label: 'Respiraste el gas',
          chaosLine: '¡Te ahogaste con el gas!',
          feedback: {
            reflection:
              'El gas no se respira: aléjate de las nubes de gas, cúbrete nariz y boca y sigue la ruta de evacuación hacia el aire libre.',
          },
        }
      : {
          id: 'fire',
          burn: true,
          label: 'Tocaste el fuego',
          chaosLine: '¡Te quemaste!',
          feedback: {
            reflection: 'El fuego no se toca: mantén distancia de las llamas y busca un camino libre de fuego y humo.',
          },
        }
    set((s) => ({
      failedOption: option,
      feedbackMessage: option.feedback,
      mistakes: [...s.mistakes, { step: s.currentStep, optionId: option.id }],
      toast: null,
      ...derive('failing'),
    }))
    clearTimeout(chaosTimer)
    chaosTimer = setTimeout(() => set(derive('failed')), CHAOS_DURATION_MS)
  },

  /**
   * Reintentar: vuelve al punto de control donde se tomó la mala decisión (otra vez la pregunta);
   * si se quemó, vuelve ahí pero caminando (la pregunta ya se respondió bien).
   */
  retry: () =>
    set((s) => ({
      attempts: s.attempts + 1,
      failedOption: null,
      feedbackMessage: null,
      ...derive(s.failedOption?.burn ? 'walking' : 'deciding'),
    })),

  /* ---------- Módulo 2: Mapa ---------- */
  selectZone: (id) => set({ selectedZone: id }),
}))

/** Selector útil: datos de la emergencia activa. */
export const useEmergency = () => useGameStore((s) => (s.selectedEmergency ? EMERGENCIES[s.selectedEmergency] : null))
