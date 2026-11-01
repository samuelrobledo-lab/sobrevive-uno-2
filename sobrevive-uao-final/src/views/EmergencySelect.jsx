import { useEffect, useState } from 'react'
import { sound } from '../audio/sound'
import { useGameStore } from '../store/useGameStore'
import { EMERGENCIES, EMERGENCY_ORDER } from '../data/emergencies'
import { IconButton, PixelButton, SoundToggle, UaoVignette } from '../components/ui/primitives'

/**
 * Selección de amenaza (wireframe 04): 3 imágenes circulares de la UAO (foto pixel del modelo 3D del campus).
 * Hover/focus → la misma imagen pero con su emergencia en pixel art, y se oye la emergencia (tierra que
 * retumba, fuego o gas) mientras el cursor esté encima.
 */
export default function EmergencySelect() {
  const { selectEmergency, goHome } = useGameStore()
  const [hovered, setHovered] = useState(null)

  // sonido de la emergencia bajo el cursor (se apaga al salir o al cambiar de pantalla)
  useEffect(() => {
    sound.preview(hovered ? EMERGENCIES[hovered].hazard : null)
  }, [hovered])
  useEffect(() => () => sound.preview(null), [])

  return (
    <section className="relative z-10 flex h-full flex-col overflow-y-auto bg-carbon-950/45 p-4">
      <header className="flex justify-end gap-2">
        <SoundToggle />
        <IconButton icon="home" label="Volver al inicio" onClick={goHome} />
      </header>

      <div className="m-auto w-full max-w-4xl py-6 text-center">
        <h1 className="font-pixel text-lg leading-relaxed sm:text-2xl">Elige la emergencia</h1>

        <ul className="mt-10 grid gap-8 sm:grid-cols-3">
          {EMERGENCY_ORDER.map((id) => {
            const e = EMERGENCIES[id]
            const active = hovered === id
            return (
              <li key={id} className="flex flex-col items-center">
                <button
                  type="button"
                  aria-label={`Ver ${e.name}`}
                  className="group pixel-circle-lg size-40 cursor-pointer overflow-hidden outline-none transition [--pixel-ring:rgb(255_255_255/0.2)] hover:[--pixel-ring:var(--color-btn-red)] focus-visible:[--pixel-ring:var(--color-signal-amber)] sm:size-44"
                  style={active ? { '--pixel-ring': e.accent } : undefined}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => selectEmergency(id)}
                >
                  <UaoVignette
                    variant={active ? e.hazard : 'base'}
                    animate={active}
                    className={`size-full ${active && e.hazard === 'quake' ? 'anim-shake' : ''}`}
                  />
                </button>
                <PixelButton
                  className="mt-5 inline-flex h-16 w-48 items-center justify-center leading-snug"
                  onClick={() => selectEmergency(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {e.name}
                </PixelButton>
              </li>
            )
          })}
        </ul>
        <p className="mt-10 text-white/70">Pasa el cursor por cada imagen para ver la emergencia.</p>
      </div>
    </section>
  )
}
