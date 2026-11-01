import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { CHARACTERS } from '../data/characters'
import { CharacterSprite, IconButton, PixelButton, SoundToggle } from '../components/ui/primitives'

/**
 * Selección de personaje (antes de elegir la emergencia).
 * Cada tarjeta muestra la caminata en loop; al pasar el mouse o enfocar, el personaje salta.
 */
export default function CharacterSelect() {
  const { selectedCharacter, selectCharacter, goTo, goHome } = useGameStore()
  const [hovered, setHovered] = useState(null)
  const base = window.innerWidth >= 640 ? 5 : 3 // escala del sprite según el ancho de pantalla

  return (
    <section className="relative z-10 flex h-full flex-col overflow-y-auto bg-carbon-950/45 p-4">
      <header className="flex justify-end gap-2">
        <SoundToggle />
        <IconButton icon="home" label="Volver al inicio" onClick={goHome} />
      </header>

      <div className="m-auto w-full max-w-4xl py-6 text-center">
        <h1 className="font-pixel text-lg leading-relaxed sm:text-2xl">Elige tu personaje</h1>

        <div role="radiogroup" aria-label="Personajes" className="mt-10 grid grid-cols-3 gap-3 sm:gap-8">
          {CHARACTERS.map((c) => {
            const selected = selectedCharacter === c.id
            const active = hovered === c.id || selected
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectCharacter(c.id)}
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(c.id)}
                onBlur={() => setHovered(null)}
                className={`glass-pixel pixel-corners flex cursor-pointer flex-col items-center gap-3 px-2 pt-6 pb-4 transition outline-none focus-visible:[--pixel-ring:var(--color-signal-amber)] sm:px-4 ${
                  selected ? 'bg-btn-red/35 [--pixel-ring:var(--color-btn-red)]' : 'hover:bg-white/10'
                }`}
              >
                <span className="grid h-28 place-items-end sm:h-40">
                  <CharacterSprite character={c} anim={active ? 'jump' : 'walk'} scale={active ? base + 1 : base} />
                </span>
                <span className="font-pixel text-[0.55rem] leading-relaxed sm:text-[0.7rem]">{c.name}</span>
                <span
                  className={`font-pixel text-[0.5rem] uppercase ${selected ? 'text-signal-green' : 'text-transparent'}`}
                  aria-hidden="true"
                >
                  ✓ Elegido
                </span>
              </button>
            )
          })}
        </div>

        <PixelButton className="mt-10" onClick={() => goTo('select')}>
          Continuar
        </PixelButton>
      </div>
    </section>
  )
}
