import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { SECTION, landing, setLanding } from '../store/landingProgress'
import Home from './Home'
import MapView from './MapView'
import StartSection from './StartSection'

/**
 * Portada en 3 secciones que se recorren con scroll:
 *   0 · Intro (amanecer + título)   1 · Comenzar la experiencia   2 · Mapa 3D interactivo
 *
 * Transición progresiva hacia abajo: la posición (`pos`, de 0 a 2) sigue el movimiento del usuario
 * —rueda del mouse, touchpad, flechas del teclado o deslizar en pantallas táctiles—.
 * Los textos de cada sección se deslizan verticalmente como una página, mientras detrás la cámara de
 * <CampusStage/> recorre el campus sin cortes y el cielo pasa del amanecer al día.
 * Al soltar, se acomoda en la sección más cercana.
 */

// en el orden de SECTION
const SECTIONS = [
  { id: 'intro', label: 'Inicio' },
  { id: 'start', label: 'Experiencia' },
  { id: 'map', label: 'Mapa 3D' },
]
const LAST = SECTIONS.length - 1
const WHEEL_PER_SECTION = 450 // px de scroll (rueda/touchpad) para pasar una sección completa
const SNAP_DELAY = 160 // ms sin movimiento antes de acomodarse
const SNAP_THRESHOLD = 0.12 // fracción de sección a partir de la cual se completa el paso al soltar
/**
 * Ruedas de mouse en Mac (y el Magic Mouse) mandan movimientos muy pequeños (4–10 px por "clic", contra
 * ~100 px en Windows): un evento aislado cuenta como mínimo MIN_NOTCH px. Los touchpads mandan muchos
 * eventos seguidos (cada ~16 ms) y siguen el gesto tal cual.
 */
const MIN_NOTCH = 60
const MAX_EVENT = 150 // tope por evento (algunos mouses mandan saltos enormes)
const ISOLATED_GAP = 60 // ms desde el evento anterior para considerarlo un "clic" de rueda
const GESTURE_GAP = 220 // ms sin eventos = empieza un gesto nuevo (la inercia del anterior ya terminó)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) // suave al salir y al llegar

function SectionContent({ index, onNext }) {
  if (index === SECTION.map) return <MapView />
  return index === SECTION.intro ? <Home onNext={onNext} /> : <StartSection onNext={onNext} />
}

const visibleAt = (pos) => SECTIONS.map((_, i) => i).filter((i) => Math.abs(i - pos) < 0.999)

export default function Landing() {
  const section = useGameStore((s) => s.landingSection)
  const setSection = useGameStore((s) => s.setLandingSection)

  // Si se vuelve desde otra pantalla (p. ej. la selección de personaje, en la sección 2), la cámara viaja desde ahí
  const pos = useRef(Math.max(0, Math.min(LAST, landing.pos)))
  const [mounted, setMounted] = useState(() => visibleAt(pos.current))
  const [settled, setSettled] = useState(section) // sección activa (para los puntos)
  const layers = useRef({})
  const snapTimer = useRef(0)
  const tween = useRef(0)
  const reduced = useRef(false)

  /** Desliza cada capa según la posición actual (la siguiente sube desde abajo). */
  const apply = useCallback(() => {
    const p = pos.current
    Object.entries(layers.current).forEach(([i, el]) => {
      if (!el) return
      const d = Number(i) - p // 0 = al frente · +1 = la que viene (abajo) · -1 = la que se fue (arriba)
      const a = Math.abs(d)
      el.style.transform = `translate3d(0, ${d * 100}%, 0)`
      el.style.zIndex = String(10 - Math.round(a * 5))
      // el mapa deja pasar el mouse al canvas 3D (sus botones activan sus propios eventos)
      el.style.pointerEvents = a < 0.5 && Number(i) !== SECTION.map ? 'auto' : 'none'
      el.inert = a >= 0.5
    })
  }, [])

  /** Cambia la posición, monta/desmonta secciones y actualiza estilos. */
  const setPos = useCallback(
    (p) => {
      pos.current = Math.max(0, Math.min(LAST, p))
      setLanding(pos.current)
      const vis = visibleAt(pos.current)
      setMounted((prev) => (prev.join() === vis.join() ? prev : vis))
      apply()
    },
    [apply],
  )

  /** Anima hasta una sección exacta y la registra en el estado global. */
  const animateTo = useCallback(
    (target, duration = 650) => {
      cancelAnimationFrame(tween.current)
      clearTimeout(snapTimer.current)
      const from = pos.current
      const to = Math.max(0, Math.min(LAST, target))
      if (reduced.current) duration = 1
      setLanding(pos.current, -1) // en movimiento
      const start = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - start) / Math.max(1, duration * Math.abs(to - from)))
        setPos(from + (to - from) * ease(t))
        if (t < 1) tween.current = requestAnimationFrame(step)
        else {
          setLanding(to, to)
          setSettled(to)
          if (useGameStore.getState().landingSection !== to) setSection(to)
        }
      }
      tween.current = requestAnimationFrame(step)
    },
    [setPos, setSection],
  )

  // Tras completar un paso con la rueda se ignora la inercia del mismo gesto (si no, saltaría dos secciones)
  const wheelLock = useRef(false)

  /** Completa el paso hacia `target` (si cambia de sección, bloquea la inercia del gesto). */
  const finishStep = useCallback(
    (target) => {
      if (target !== useGameStore.getState().landingSection) wheelLock.current = true
      animateTo(target, 450)
    },
    [animateTo],
  )

  /** Al detenerse: si avanzó más de SNAP_THRESHOLD, completa el paso; si no, regresa. */
  const scheduleSnap = useCallback(() => {
    clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      const from = useGameStore.getState().landingSection
      const delta = pos.current - from
      finishStep(Math.abs(delta) > SNAP_THRESHOLD ? from + Math.sign(delta) : from)
    }, SNAP_DELAY)
  }, [finishStep])

  /** Movimiento directo del usuario (sigue el gesto en tiempo real, como mucho una sección por gesto). */
  const nudge = useCallback(
    (delta) => {
      cancelAnimationFrame(tween.current)
      landing.settled = -1
      const from = useGameStore.getState().landingSection
      const next = Math.max(from - 1, Math.min(from + 1, pos.current + delta))
      setPos(next)
      // si ya llegó a la sección vecina, termina ahí mismo (no espera a que se detenga la inercia)
      if (Math.abs(next - from) >= 0.999 && next >= 0 && next <= LAST) {
        clearTimeout(snapTimer.current)
        finishStep(Math.round(next))
      } else scheduleSnap()
    },
    [setPos, scheduleSnap, finishStep],
  )



  // Estilos iniciales y en cada (des)montaje de capas
  useLayoutEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    apply()
  }, [mounted, apply])

  // Cambios externos (p. ej. "Ver mapa 3D" o el botón de inicio) y llegada desde otra pantalla
  useEffect(() => {
    if (pos.current !== section) animateTo(section, 800)
    else setLanding(section, section)
  }, [section, animateTo])

  // Entradas
  useEffect(() => {
    let lastWheel = 0
    const onWheel = (e) => {
      if (e.ctrlKey || e.target.closest?.('[role="dialog"], aside')) return // pellizco / fichas y guías con su propio scroll
      const now = performance.now()
      const gap = now - lastWheel
      lastWheel = now
      if (gap > GESTURE_GAP) wheelLock.current = false
      if (wheelLock.current) return
      let px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
      if (!px) return
      if (gap > ISOLATED_GAP) px = Math.sign(px) * Math.max(Math.abs(px), MIN_NOTCH) // "clic" de rueda
      px = Math.max(-MAX_EVENT, Math.min(MAX_EVENT, px))
      nudge(px / WHEEL_PER_SECTION)
    }
    const onKey = (e) => {
      if (['ArrowDown', 'PageDown'].includes(e.key)) animateTo(Math.round(pos.current) + 1, 800)
      if (['ArrowUp', 'PageUp'].includes(e.key)) animateTo(Math.round(pos.current) - 1, 800)
    }
    let touch = null
    const onTouchStart = (e) => {
      // sobre el mapa 3D el dedo gira la cámara: no se usa para cambiar de sección
      const onMap = e.target.closest?.('canvas') && Math.round(pos.current) === SECTION.map
      touch = onMap ? null : e.touches[0].clientY
      if (touch != null) cancelAnimationFrame(tween.current)
    }
    const onTouchMove = (e) => {
      if (touch == null) return
      const y = e.touches[0].clientY
      nudge((touch - y) / (window.innerHeight * 0.8))
      touch = y
    }
    const onTouchEnd = () => {
      touch = null
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      cancelAnimationFrame(tween.current)
      clearTimeout(snapTimer.current)
    }
  }, [nudge, animateTo])

  const next = () => animateTo(Math.round(pos.current) + 1, 800)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {mounted.map((i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) layers.current[i] = el
            else delete layers.current[i]
          }}
          className="absolute inset-0 overflow-hidden will-change-transform"
        >
          <SectionContent index={i} onNext={next} />
        </div>
      ))}

      {/* Indicador de secciones */}
      <nav aria-label="Secciones" className="pointer-events-auto absolute top-1/2 left-3 z-50 flex -translate-y-1/2 flex-col gap-3">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.label}
            aria-current={settled === i ? 'step' : undefined}
            title={s.label}
            onClick={() => animateTo(i, 800)}
            className={`pixel-circle-sm size-3 cursor-pointer transition ${settled === i ? 'scale-125 bg-btn-red' : 'bg-white/55 hover:bg-white/80'}`}
          />
        ))}
      </nav>
    </div>
  )
}
